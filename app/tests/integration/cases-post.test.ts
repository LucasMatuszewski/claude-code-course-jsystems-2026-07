// @vitest-environment node

/**
 * Integration tests for `POST /api/cases` (ADR-000 §6, §9.3; PRD AC-06/07,
 * AC-10..14, AC-20, AC-32/33/35).
 *
 * Real temp SQLite file + real filesystem uploads dir + real temp policy
 * docs; only the OpenRouter model calls are mocked (via `MockLanguageModelV4`
 * injected as deps). NO network. The route is exercised through its
 * dependency-injected factory `createCasesPostHandler`.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import type Database from "better-sqlite3";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createCasesPostHandler } from "@/app/api/cases/route";
import { createDb } from "@/lib/db/client";
import { getCaseWithHistory } from "@/lib/db/cases";
import { pl } from "@/lib/copy/pl";
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/validation/case-form.schema";
import type { Models } from "@/lib/ai/providers";
import type { ImageAnalysis, Decision } from "@/lib/ai/schemas";

// ----------------------------------------------------------------------------
// Mock model helpers (shape confirmed by the committed lib/ai unit tests).
// ----------------------------------------------------------------------------

function jsonModel(value: unknown): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(value) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

function failingModel(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error("network boom");
    },
  });
}

const conclusiveAnalysis: ImageAnalysis = {
  conclusive: true,
  damaged: false,
  damageType: null,
  plausibleCause: null,
  usageSigns: false,
  confidence: "high",
  customerFacingIssue: null,
  internalNotes: "Brak śladów użytkowania.",
};

const inconclusiveAnalysis: ImageAnalysis = {
  conclusive: false,
  damaged: false,
  damageType: null,
  plausibleCause: null,
  usageSigns: null,
  confidence: "low",
  customerFacingIssue: "Zdjęcie jest zbyt rozmyte, aby ocenić stan produktu.",
  internalNotes: "Obraz nieostry.",
};

const approvedDecision: Decision = {
  status: "approved",
  justification: "Zgodnie z zasadami zwrotów produkt nie nosi śladów użytkowania.",
  nextSteps: ["Zapakuj produkt.", "Wyślij paczkę na wskazany adres."],
  isRevision: false,
  requiresBetterPhoto: false,
};

const escalationDecision: Decision = {
  status: "needs_human_review",
  justification: "Sprawa wymaga weryfikacji przez pracownika.",
  nextSteps: ["Poczekaj na kontakt pracownika serwisu."],
  isRevision: false,
  requiresBetterPhoto: false,
};

// ----------------------------------------------------------------------------
// Test fixtures: temp db, uploads dir, policies dir; real + fake image files.
// ----------------------------------------------------------------------------

let realImageBuffer: Buffer;

beforeAll(async () => {
  realImageBuffer = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
});

function realImageFile(): File {
  return new File([new Uint8Array(realImageBuffer)], "sprzet.png", { type: "image/png" });
}

function fakeImageFile(type: string, sizeBytes: number, name = "plik"): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

interface FieldOverrides {
  requestType?: string;
  category?: string;
  productName?: string;
  purchaseDate?: string;
  description?: string;
}

function buildRequest(fields: FieldOverrides, image: File | null): Request {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    requestType: "zwrot",
    category: "Słuchawki",
    productName: "Sony WH-1000XM5",
    purchaseDate: "2025-06-01",
  };
  const merged = { ...defaults, ...fields } as Record<string, string | undefined>;
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined) {
      fd.set(key, value);
    }
  }
  if (image) {
    fd.set("image", image);
  }
  return new Request("http://localhost/api/cases", { method: "POST", body: fd });
}

function retryRequest(caseId: string): Request {
  const fd = new FormData();
  fd.set("caseId", caseId);
  return new Request("http://localhost/api/cases", { method: "POST", body: fd });
}

let db: Database.Database;
let dbPath: string;
let uploadsBaseDir: string;
let policiesDir: string;

function makeDeps(models: Models): {
  db: Database.Database;
  models: Models;
  uploadsBaseDir: string;
  policiesDir: string;
} {
  return { db, models, uploadsBaseDir, policiesDir };
}

function models(vision: MockLanguageModelV4, text: MockLanguageModelV4): Models {
  return { visionModel: vision, textModel: text };
}

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hsc-cases-post-"));
  dbPath = path.join(dir, "copilot.db");
  db = createDb(dbPath);
  uploadsBaseDir = path.join(dir, "uploads");
  policiesDir = path.join(dir, "policies");
  fs.mkdirSync(policiesDir, { recursive: true });
  fs.writeFileSync(path.join(policiesDir, "zasady-zwrotow.md"), "# Zasady zwrotów\n14 dni.");
  fs.writeFileSync(path.join(policiesDir, "zasady-reklamacji.md"), "# Zasady reklamacji\n2 lata.");
});

afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe("POST /api/cases", () => {
  it("creates a zwrot case, returns the full decision shape, and persists all rows", async () => {
    const vision = jsonModel(conclusiveAnalysis);
    const text = jsonModel(approvedDecision);
    const handler = createCasesPostHandler(makeDeps(models(vision, text)));

    const res = await handler(buildRequest({}, realImageFile()));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(typeof body.caseId).toBe("string");
    expect(body.caseNumber).toMatch(/^HSC-\d{8}-\d{4}$/);
    expect(body.requiresBetterPhoto).toBe(false);
    expect(body.decision).toEqual({
      status: "approved",
      justification: approvedDecision.justification,
      nextSteps: approvedDecision.nextSteps,
      disclaimer: pl.chat.disclaimer,
    });

    const detail = getCaseWithHistory(db, body.caseId);
    expect(detail).not.toBeNull();
    expect(detail!.images).toHaveLength(1);
    expect(detail!.analyses).toHaveLength(1);
    expect(detail!.decisions).toHaveLength(1);
    expect(detail!.decisions[0].status).toBe("approved");

    // AC-20: first assistant chat message persisted.
    expect(detail!.messages).toHaveLength(1);
    expect(detail!.messages[0].role).toBe("assistant");
    const firstPart = detail!.messages[0].parts[0] as { type: string; text: string };
    expect(firstPart.type).toBe("text");
    expect(firstPart.text).toContain(pl.chat.disclaimer);
    expect(firstPart.text).toContain(body.caseNumber);

    // Image was actually written to disk under the injected uploads dir.
    const absImage = path.join(uploadsBaseDir, body.caseId, "1.jpg");
    expect(fs.existsSync(absImage)).toBe(true);
  });

  it("rejects a reklamacja without a description (400) with the exact Polish message and zero AI calls", async () => {
    const vision = jsonModel(conclusiveAnalysis);
    const text = jsonModel(approvedDecision);
    const handler = createCasesPostHandler(makeDeps(models(vision, text)));

    const res = await handler(
      buildRequest({ requestType: "reklamacja" }, fakeImageFile("image/jpeg", 1024)),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fieldErrors.description).toBe(pl.form.errors.descriptionRequiredForComplaint);
    expect(vision.doGenerateCalls).toHaveLength(0);
    expect(text.doGenerateCalls).toHaveLength(0);
  });

  it("rejects an oversized image (400) with zero AI calls", async () => {
    const vision = jsonModel(conclusiveAnalysis);
    const text = jsonModel(approvedDecision);
    const handler = createCasesPostHandler(makeDeps(models(vision, text)));

    const res = await handler(
      buildRequest({}, fakeImageFile("image/jpeg", MAX_IMAGE_SIZE_BYTES + 1)),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fieldErrors.image).toBe(pl.form.errors.imageTooLarge);
    expect(vision.doGenerateCalls).toHaveLength(0);
    expect(text.doGenerateCalls).toHaveLength(0);
  });

  it("rejects an unsupported MIME type (400) with zero AI calls", async () => {
    const vision = jsonModel(conclusiveAnalysis);
    const text = jsonModel(approvedDecision);
    const handler = createCasesPostHandler(makeDeps(models(vision, text)));

    const res = await handler(buildRequest({}, fakeImageFile("image/gif", 1024)));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fieldErrors.image).toBe(pl.form.errors.imageInvalidType);
    expect(vision.doGenerateCalls).toHaveLength(0);
    expect(text.doGenerateCalls).toHaveLength(0);
  });

  it("returns requiresBetterPhoto and no decision row when the first analysis is inconclusive", async () => {
    const vision = jsonModel(inconclusiveAnalysis);
    const text = jsonModel(approvedDecision);
    const handler = createCasesPostHandler(makeDeps(models(vision, text)));

    const res = await handler(buildRequest({}, realImageFile()));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.requiresBetterPhoto).toBe(true);
    expect(body.decision).toBeNull();

    const detail = getCaseWithHistory(db, body.caseId);
    expect(detail!.analyses).toHaveLength(1);
    expect(detail!.decisions).toHaveLength(0);
    // The decision agent was never invoked.
    expect(text.doGenerateCalls).toHaveLength(0);
    // A first assistant message asking for a better photo was still persisted.
    expect(detail!.messages).toHaveLength(1);
    const firstPart = detail!.messages[0].parts[0] as { type: string; text: string };
    expect(firstPart.text).toContain(pl.chat.reupload.prompt);
  });

  it("sets cases.needs_review when the decision is needs_human_review", async () => {
    const vision = jsonModel(conclusiveAnalysis);
    const text = jsonModel(escalationDecision);
    const handler = createCasesPostHandler(makeDeps(models(vision, text)));

    const res = await handler(buildRequest({}, realImageFile()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision.status).toBe("needs_human_review");

    const detail = getCaseWithHistory(db, body.caseId);
    expect(detail!.needsReview).toBe(true);
  });

  it("returns 502 { retryable: true } when the vision call fails, with case + image already persisted", async () => {
    const vision = failingModel();
    const text = jsonModel(approvedDecision);
    const handler = createCasesPostHandler(makeDeps(models(vision, text)));

    const res = await handler(buildRequest({}, realImageFile()));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.retryable).toBe(true);
    expect(typeof body.caseId).toBe("string");

    const detail = getCaseWithHistory(db, body.caseId);
    expect(detail).not.toBeNull();
    expect(detail!.images).toHaveLength(1);
    expect(detail!.analyses).toHaveLength(0);
    expect(detail!.decisions).toHaveLength(0);
  });

  it("returns 502 when the decision call fails, with the analysis already persisted", async () => {
    const vision = jsonModel(conclusiveAnalysis);
    const text = failingModel();
    const handler = createCasesPostHandler(makeDeps(models(vision, text)));

    const res = await handler(buildRequest({}, realImageFile()));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.retryable).toBe(true);

    const detail = getCaseWithHistory(db, body.caseId);
    expect(detail!.analyses).toHaveLength(1);
    expect(detail!.decisions).toHaveLength(0);
  });

  it("retries via caseId: re-runs only the AI pipeline, adds no new case/image rows, returns 200", async () => {
    // First attempt fails at the vision stage -> case + image persisted, no analysis.
    const failHandler = createCasesPostHandler(
      makeDeps(models(failingModel(), jsonModel(approvedDecision))),
    );
    const failRes = await failHandler(buildRequest({}, realImageFile()));
    expect(failRes.status).toBe(502);
    const failBody = await failRes.json();
    const caseId: string = failBody.caseId;
    expect(typeof caseId).toBe("string");

    const casesBefore = (db.prepare("SELECT COUNT(*) AS c FROM cases").get() as { c: number }).c;
    const imagesBefore = (
      db.prepare("SELECT COUNT(*) AS c FROM case_images").get() as { c: number }
    ).c;

    // Retry with working models against the stored image (no re-upload).
    const vision = jsonModel(conclusiveAnalysis);
    const text = jsonModel(approvedDecision);
    const retryHandler = createCasesPostHandler(makeDeps(models(vision, text)));
    const res = await retryHandler(retryRequest(caseId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.caseId).toBe(caseId);
    expect(body.decision.status).toBe("approved");

    const casesAfter = (db.prepare("SELECT COUNT(*) AS c FROM cases").get() as { c: number }).c;
    const imagesAfter = (
      db.prepare("SELECT COUNT(*) AS c FROM case_images").get() as { c: number }
    ).c;
    expect(casesAfter).toBe(casesBefore);
    expect(imagesAfter).toBe(imagesBefore);

    const detail = getCaseWithHistory(db, caseId);
    expect(detail!.analyses).toHaveLength(1);
    expect(detail!.decisions).toHaveLength(1);
    // The vision model was actually re-invoked against the stored image.
    expect(vision.doGenerateCalls).toHaveLength(1);
  });

  it("returns 404 when retrying an unknown caseId", async () => {
    const handler = createCasesPostHandler(
      makeDeps(models(jsonModel(conclusiveAnalysis), jsonModel(approvedDecision))),
    );
    const res = await handler(retryRequest("does-not-exist"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe(pl.errors.caseNotFound);
  });

  it("still returns the decision (200) when the non-critical chat-message insert fails (AC-35)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Make only the chat_messages INSERT throw, leaving decision writes intact.
    const realPrepare = db.prepare.bind(db);
    db.prepare = ((sql: string) => {
      const stmt = realPrepare(sql);
      if (/INSERT INTO chat_messages/i.test(sql)) {
        return new Proxy(stmt, {
          get(target, prop, receiver) {
            if (prop === "run") {
              return () => {
                throw new Error("disk full");
              };
            }
            return Reflect.get(target, prop, receiver);
          },
        });
      }
      return stmt;
    }) as typeof db.prepare;

    const handler = createCasesPostHandler(
      makeDeps(models(jsonModel(conclusiveAnalysis), jsonModel(approvedDecision))),
    );
    const res = await handler(buildRequest({}, realImageFile()));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision.status).toBe("approved");
    expect(consoleSpy).toHaveBeenCalled();

    const detail = getCaseWithHistory(db, body.caseId);
    expect(detail!.decisions).toHaveLength(1);
    expect(detail!.messages).toHaveLength(0);
  });
});
