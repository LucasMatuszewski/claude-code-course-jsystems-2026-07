// @vitest-environment node

/**
 * Integration tests for `POST /api/cases/[caseId]/chat` (ADR-000 §6, §9.3;
 * ADR-002 §3/§5; PRD AC-14, AC-21..25, AC-33).
 *
 * Real temp SQLite file + real filesystem uploads dir + real temp policy
 * docs; only the OpenRouter model calls are mocked (a streaming
 * `MockLanguageModelV4` for the text/chat model, a `doGenerate` mock for the
 * re-upload vision analysis). NO network. The route is exercised through its
 * dependency-injected factory `createChatPostHandler`.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import type Database from "better-sqlite3";
import { MockLanguageModelV4, convertArrayToReadableStream } from "ai/test";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createChatPostHandler } from "@/app/api/cases/[caseId]/chat/route";
import { createDb } from "@/lib/db/client";
import { createCase } from "@/lib/db/cases";
import { getCaseWithHistory } from "@/lib/db/cases";
import { insertCaseImage } from "@/lib/db/case-images";
import { insertImageAnalysis } from "@/lib/db/image-analyses";
import { insertDecision } from "@/lib/db/decisions";
import { appendChatMessage } from "@/lib/db/chat-messages";
import { writeCaseImage } from "@/lib/images/storage";
import { pl } from "@/lib/copy/pl";
import type { Models } from "@/lib/ai/providers";
import type { ImageAnalysis, Decision } from "@/lib/ai/schemas";
import type { RequestType } from "@/lib/validation/case-form.schema";

// ----------------------------------------------------------------------------
// Mock model helpers.
// ----------------------------------------------------------------------------

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

/** A streaming text model that emits `text` in two deltas, no tool call. */
function streamingTextModel(text: string): MockLanguageModelV4 {
  const mid = Math.max(1, Math.ceil(text.length / 2));
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: "stream-start", warnings: [] },
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: text.slice(0, mid) },
        { type: "text-delta", id: "t1", delta: text.slice(mid) },
        { type: "text-end", id: "t1" },
        { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage: USAGE },
      ]),
    }),
  });
}

/**
 * A streaming text model that emits a short lead-in text and then a
 * `submitDecision` tool call carrying the given decision.
 */
function submitDecisionModel(decision: Decision, leadIn = "Oto Twoja decyzja."): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: "stream-start", warnings: [] },
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: leadIn },
        { type: "text-end", id: "t1" },
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "submitDecision",
          input: JSON.stringify(decision),
        },
        { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage: USAGE },
      ]),
    }),
  });
}

/** A `doGenerate` (non-streaming) vision model returning the given analysis. */
function visionModel(analysis: ImageAnalysis): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(analysis) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: USAGE,
      warnings: [],
    }),
  });
}

// ----------------------------------------------------------------------------
// Fixtures.
// ----------------------------------------------------------------------------

const conclusiveAnalysis: ImageAnalysis = {
  conclusive: true,
  damaged: false,
  damageType: null,
  plausibleCause: null,
  usageSigns: false,
  confidence: "high",
  customerFacingIssue: null,
  internalNotes: "MARKER-ANALIZY brak śladów użytkowania.",
};

const inconclusiveAnalysis: ImageAnalysis = {
  conclusive: false,
  damaged: false,
  damageType: null,
  plausibleCause: null,
  usageSigns: null,
  confidence: "low",
  customerFacingIssue: "Zdjęcie jest zbyt rozmyte.",
  internalNotes: "Obraz nieostry.",
};

const approvedDecision: Decision = {
  status: "approved",
  justification: "Produkt nie nosi śladów użytkowania zgodnie z zasadami zwrotów.",
  nextSteps: ["Zapakuj produkt.", "Wyślij paczkę."],
  isRevision: false,
  requiresBetterPhoto: false,
};

const rejectedDecision: Decision = {
  status: "rejected",
  justification: "Produkt nosi ślady użytkowania.",
  nextSteps: ["Zachowaj produkt."],
  isRevision: false,
  requiresBetterPhoto: false,
};

let jpegBuffer: Buffer;
let pngDataUrl: string;

beforeAll(async () => {
  jpegBuffer = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .jpeg()
    .toBuffer();
  const png = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 40, g: 50, b: 60 } },
  })
    .png()
    .toBuffer();
  pngDataUrl = `data:image/png;base64,${png.toString("base64")}`;
});

let db: Database.Database;
let uploadsBaseDir: string;
let policiesDir: string;

function makeDeps(text: MockLanguageModelV4, vision?: MockLanguageModelV4): {
  db: Database.Database;
  models: Models;
  uploadsBaseDir: string;
  policiesDir: string;
} {
  const models: Models = {
    textModel: text,
    visionModel: vision ?? visionModel(conclusiveAnalysis),
  };
  return { db, models, uploadsBaseDir, policiesDir };
}

interface SeedOptions {
  requestType?: RequestType;
  formAnalysisConclusive?: boolean;
  withDecision?: boolean;
}

/** Seeds a case with a form image + analysis (+ optional first decision) using the real repo layer. */
function seedCase(opts: SeedOptions = {}): { id: string; caseNumber: string } {
  const requestType = opts.requestType ?? "zwrot";
  const created = createCase(db, {
    requestType,
    category: "Słuchawki",
    productName: "Sony WH-1000XM5",
    purchaseDate: "2025-06-01",
    description: requestType === "reklamacja" ? "Nie działa." : null,
  });
  const stored = writeCaseImage(created.id, jpegBuffer, uploadsBaseDir);
  const img = insertCaseImage(db, created.id, {
    filePath: stored.relativePath,
    source: "form",
    originalFilename: "foto.jpg",
    mimeType: "image/jpeg",
  });
  const analysis = opts.formAnalysisConclusive === false ? inconclusiveAnalysis : conclusiveAnalysis;
  insertImageAnalysis(db, created.id, img.id, { conclusive: analysis.conclusive, analysis });
  if (opts.withDecision) {
    insertDecision(db, created.id, {
      status: "approved",
      justification: "Pierwsza decyzja.",
      nextSteps: ["Krok."],
    });
  }
  appendChatMessage(db, created.id, "assistant", [{ type: "text", text: "Pierwsza wiadomość." }]);
  return { id: created.id, caseNumber: created.caseNumber };
}

function userTextMessage(text: string) {
  return { id: "u1", role: "user", parts: [{ type: "text", text }] };
}

function userImageMessage(text: string) {
  return {
    id: "u1",
    role: "user",
    parts: [
      { type: "text", text },
      { type: "file", mediaType: "image/png", filename: "nowe.png", url: pngDataUrl },
    ],
  };
}

function buildRequest(messages: unknown[]): Request {
  return new Request("http://localhost/api/cases/x/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });
}

function routeContext(caseId: string): { params: Promise<{ caseId: string }> } {
  return { params: Promise.resolve({ caseId }) };
}

/** Fully drains a streamed Response, returning chunk count + concatenated text. */
async function drain(res: Response): Promise<{ chunks: number; text: string }> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let chunks = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks += 1;
      text += decoder.decode(value, { stream: true });
    }
  }
  // Let the async onEnd persistence callback settle before asserting on the DB.
  await new Promise((resolve) => setTimeout(resolve, 30));
  return { chunks, text };
}

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hsc-chat-"));
  db = createDb(path.join(dir, "copilot.db"));
  uploadsBaseDir = path.join(dir, "uploads");
  policiesDir = path.join(dir, "policies");
  fs.mkdirSync(policiesDir, { recursive: true });
  fs.writeFileSync(path.join(policiesDir, "zasady-zwrotow.md"), "# Zasady zwrotów\nMARKER-ZASADY-ZWROTU");
  fs.writeFileSync(
    path.join(policiesDir, "zasady-reklamacji.md"),
    "# Zasady reklamacji\nMARKER-ZASADY-REKLAMACJI",
  );
});

afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe("POST /api/cases/[caseId]/chat", () => {
  it("returns 404 for an unknown caseId", async () => {
    const handler = createChatPostHandler(makeDeps(streamingTextModel("cześć")));
    const res = await handler(buildRequest([userTextMessage("Dzień dobry")]), routeContext("nope"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe(pl.errors.caseNotFound);
  });

  it("streams a UI-message response as more than one chunk (TAC-06)", async () => {
    const seeded = seedCase();
    const handler = createChatPostHandler(makeDeps(streamingTextModel("Cześć, w czym mogę pomóc?")));
    const res = await handler(buildRequest([userTextMessage("Mam pytanie.")]), routeContext(seeded.id));
    expect(res.status).toBe(200);
    const { chunks } = await drain(res);
    expect(chunks).toBeGreaterThan(1);
  });

  it("rebuilds full context from the DB: system prompt carries policy + form + latest analysis (AC-21)", async () => {
    const seeded = seedCase();
    const text = streamingTextModel("Odpowiedź.");
    const handler = createChatPostHandler(makeDeps(text));
    const res = await handler(buildRequest([userTextMessage("Pytanie.")]), routeContext(seeded.id));
    await drain(res);

    expect(text.doStreamCalls).toHaveLength(1);
    const systemMessage = text.doStreamCalls[0].prompt.find((m) => m.role === "system");
    expect(systemMessage).toBeDefined();
    const systemText =
      typeof systemMessage!.content === "string"
        ? systemMessage!.content
        : JSON.stringify(systemMessage!.content);
    expect(systemText).toContain("MARKER-ZASADY-ZWROTU"); // policy markdown
    expect(systemText).toContain("Sony WH-1000XM5"); // form data
    expect(systemText).toContain("MARKER-ANALIZY"); // latest image analysis
  });

  it("inserts exactly one decision row (isRevision=false) when submitDecision is called with no prior decision", async () => {
    const seeded = seedCase({ withDecision: false });
    const handler = createChatPostHandler(makeDeps(submitDecisionModel(approvedDecision)));
    const res = await handler(buildRequest([userTextMessage("Proszę o decyzję.")]), routeContext(seeded.id));
    await drain(res);

    const detail = getCaseWithHistory(db, seeded.id)!;
    expect(detail.decisions).toHaveLength(1);
    expect(detail.decisions[0].status).toBe("approved");
    expect(detail.decisions[0].isRevision).toBe(false);
  });

  it("marks isRevision=true only when a prior decision already exists (TAC-002-03)", async () => {
    const seeded = seedCase({ withDecision: true });
    const handler = createChatPostHandler(makeDeps(submitDecisionModel(rejectedDecision)));
    const res = await handler(
      buildRequest([userTextMessage("Nowe informacje zmieniają sprawę.")]),
      routeContext(seeded.id),
    );
    await drain(res);

    const detail = getCaseWithHistory(db, seeded.id)!;
    expect(detail.decisions).toHaveLength(2);
    expect(detail.decisions[1].isRevision).toBe(true);
    expect(detail.decisions[1].status).toBe("rejected");
  });

  it("persists the user message and the full assistant response via onFinish (AC-33)", async () => {
    const seeded = seedCase();
    const handler = createChatPostHandler(makeDeps(submitDecisionModel(approvedDecision)));
    const res = await handler(buildRequest([userTextMessage("Dzień dobry.")]), routeContext(seeded.id));
    await drain(res);

    const detail = getCaseWithHistory(db, seeded.id)!;
    // seed added 1 assistant message; this turn adds user + assistant.
    expect(detail.messages).toHaveLength(3);
    const userMsg = detail.messages[1];
    expect(userMsg.role).toBe("user");
    expect(JSON.stringify(userMsg.parts)).toContain("Dzień dobry.");

    const assistantMsg = detail.messages[2];
    expect(assistantMsg.role).toBe("assistant");
    const partTypes = (assistantMsg.parts as Array<{ type: string }>).map((p) => p.type);
    expect(partTypes).toContain("text");
    // The submitDecision tool call is persisted as a `tool-submitDecision` part.
    expect(partTypes).toContain("tool-submitDecision");
  });

  it("re-upload: compresses, re-analyzes, and inserts a new case_image + image_analysis before deciding (flow 4.3)", async () => {
    const seeded = seedCase();
    const vision = visionModel(conclusiveAnalysis);
    const handler = createChatPostHandler(makeDeps(submitDecisionModel(approvedDecision), vision));
    const res = await handler(
      buildRequest([userImageMessage("Przesyłam lepsze zdjęcie.")]),
      routeContext(seeded.id),
    );
    expect(res.status).toBe(200);
    await drain(res);

    // Re-analysis actually ran against the re-uploaded image.
    expect(vision.doGenerateCalls).toHaveLength(1);

    const detail = getCaseWithHistory(db, seeded.id)!;
    expect(detail.images).toHaveLength(2);
    expect(detail.images[1].source).toBe("chat_reupload");
    expect(detail.analyses).toHaveLength(2);
    // A new decision was produced after the conclusive re-analysis.
    expect(detail.decisions).toHaveLength(1);
    expect(detail.decisions[0].status).toBe("approved");

    // The compressed re-upload was written to disk under the case dir.
    const absImage = path.join(uploadsBaseDir, seeded.id, "2.jpg");
    expect(fs.existsSync(absImage)).toBe(true);
  });

  it("forces a needs_human_review decision when the second analysis is also inconclusive (AC-14)", async () => {
    // Form analysis was already inconclusive; the chat re-upload is the 2nd inconclusive analysis.
    const seeded = seedCase({ formAnalysisConclusive: false });
    const vision = visionModel(inconclusiveAnalysis);
    // Even though the (mock) text model tries to approve, the route must force escalation.
    const handler = createChatPostHandler(makeDeps(submitDecisionModel(approvedDecision), vision));
    const res = await handler(
      buildRequest([userImageMessage("Kolejne zdjęcie.")]),
      routeContext(seeded.id),
    );
    expect(res.status).toBe(200);
    await drain(res);

    const detail = getCaseWithHistory(db, seeded.id)!;
    expect(detail.analyses).toHaveLength(2);
    expect(detail.decisions).toHaveLength(1);
    expect(detail.decisions[0].status).toBe("needs_human_review");
    expect(detail.needsReview).toBe(true);
  });
});
