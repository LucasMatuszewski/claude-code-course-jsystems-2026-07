/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/sessions/:id/analyze (ADR-000 section 6,
 * ADR-001 section 5, ADR-003 section 7, AC-10, AC-28).
 *
 * Real SQLite, repositories, filesystem reads, and policy loading. Only the
 * external LLM provider boundary is mocked via `@/lib/ai/provider`.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { LanguageModelV4, LanguageModelV4CallOptions } from "@ai-sdk/provider";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppDatabase } from "@/lib/db/client";
import {
  createSession,
  getSessionWithHistory,
  type SessionImageMeta,
  type ValidatedSessionForm,
} from "@/lib/db/repositories";
import { pl } from "@/lib/i18n";
import { todayIsoDate } from "@/lib/validation";

import { POST } from "./route";

const APP_ROOT = process.cwd();
const DRIZZLE_DIR = path.join(APP_ROOT, "drizzle");

const testDb = vi.hoisted<{
  db: AppDatabase | null;
  close: (() => void) | null;
}>(() => ({ db: null, close: null }));

const testModels = vi.hoisted<{
  vision: LanguageModelV4 | null;
  text: LanguageModelV4 | null;
}>(() => ({ vision: null, text: null }));

vi.mock("@/lib/db/client", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/db/client")>();
  return {
    ...actual,
    getDb: () => {
      if (!testDb.db) {
        throw new Error("Test DB not initialized for this test");
      }
      return testDb.db;
    },
  };
});

vi.mock("@/lib/ai/provider", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/ai/provider")>();
  return {
    ...actual,
    getVisionModel: () => {
      if (!testModels.vision) throw new Error("Test vision model not set");
      return testModels.vision;
    },
    getTextModel: () => {
      if (!testModels.text) throw new Error("Test text model not set");
      return testModels.text;
    },
  };
});

const { createDb, getDb } = await import("@/lib/db/client");

interface MockGenerateResult {
  content: Array<{ type: "text"; text: string }>;
  finishReason: "stop";
  usage: { inputTokens: number; outputTokens: number };
  warnings: unknown[];
}

type GenerateFn = (
  options: LanguageModelV4CallOptions,
) => Promise<MockGenerateResult>;

function okResult(json: string): MockGenerateResult {
  return {
    content: [{ type: "text", text: json }],
    finishReason: "stop",
    usage: { inputTokens: 10, outputTokens: 5 },
    warnings: [],
  };
}

function usableVisionJson(): string {
  return JSON.stringify({
    imageUsable: true,
    unusableReason: null,
    matchesDeclaredProduct: true,
    damageVisible: true,
    damageDescription: "Pęknięty ekran w lewym górnym rogu.",
    plausibleCauses: "Uszkodzenie mechaniczne.",
    usageSigns: null,
    resellableAssessment: null,
    confidence: "high",
  });
}

function unusableVisionJson(): string {
  return JSON.stringify({
    imageUsable: false,
    unusableReason: "Zdjęcie jest nieostre.",
    matchesDeclaredProduct: false,
    damageVisible: false,
    damageDescription: null,
    plausibleCauses: null,
    usageSigns: null,
    resellableAssessment: null,
    confidence: "low",
  });
}

function approveDecisionJson(messageMarkdown = "Dzień dobry.\n\nDecyzja: pozytywna."): string {
  return JSON.stringify({
    decision: "APPROVE",
    justification: "Zgłoszenie spełnia warunki polityki.",
    citedRuleIds: ["C-2"],
    missingInfo: null,
    messageMarkdown,
  });
}

function makeVisionModel(
  doGenerate: GenerateFn = async () => okResult(usableVisionJson()),
): { model: LanguageModelV4; doGenerate: ReturnType<typeof vi.fn<GenerateFn>> } {
  const mocked = vi.fn<GenerateFn>(doGenerate);
  return {
    model: new MockLanguageModelV4({
      modelId: "openai/vision-mock",
      doGenerate: mocked as unknown as Parameters<typeof MockLanguageModelV4>[0] extends {
        doGenerate?: infer F;
      }
        ? F
        : never,
    }),
    doGenerate: mocked,
  };
}

function makeTextModel(
  doGenerate: GenerateFn = async () => okResult(approveDecisionJson()),
): { model: LanguageModelV4; doGenerate: ReturnType<typeof vi.fn<GenerateFn>> } {
  const mocked = vi.fn<GenerateFn>(doGenerate);
  return {
    model: new MockLanguageModelV4({
      modelId: "openai/text-mock",
      doGenerate: mocked as unknown as Parameters<typeof MockLanguageModelV4>[0] extends {
        doGenerate?: infer F;
      }
        ? F
        : never,
    }),
    doGenerate: mocked,
  };
}

function baseForm(): ValidatedSessionForm {
  return {
    requestType: "complaint",
    category: "smartphone",
    productName: "iPhone 15 Pro",
    purchaseDate: todayIsoDate(),
    reason: "Ekran pękł po upadku.",
  };
}

async function createStoredSession(tmpRoot: string) {
  const imagePath = path.join(tmpRoot, "fixture.jpg");
  await writeFile(imagePath, Buffer.from("fake-jpeg-bytes"));
  const imageMeta: SessionImageMeta = {
    imagePath: path.relative(process.cwd(), imagePath),
    imageOriginalName: "photo.jpg",
    imageMediaType: "image/jpeg",
  };
  return createSession(getDb(), baseForm(), imageMeta);
}

async function callAnalyze(sessionId: string): Promise<Response> {
  const request = new Request(`http://localhost/api/sessions/${sessionId}/analyze`, {
    method: "POST",
  });
  const context = { params: Promise.resolve({ id: sessionId }) };
  return POST(request, context);
}

function parseTextParts(raw: string): Array<{ type: string; text?: string }> {
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) ? (parsed as Array<{ type: string; text?: string }>) : [];
}

describe("POST /api/sessions/:id/analyze", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    const handle = createDb({
      filePath: ":memory:",
      migrationsFolder: DRIZZLE_DIR,
    });
    testDb.db = handle.db;
    testDb.close = handle.close;
    testModels.vision = null;
    testModels.text = null;
    tmpRoot = await mkdtemp(path.join(tmpdir(), "sessions-analyze-route-"));
  });

  afterEach(async () => {
    testDb.close?.();
    testDb.db = null;
    testDb.close = null;
    testModels.vision = null;
    testModels.text = null;
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("returns 404 for an unknown session id", async () => {
    const res = await callAnalyze("does-not-exist");

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: "Nie znaleziono sesji o podanym identyfikatorze.",
    });
  });

  it("runs the analysis pipeline, persists the initial decision and first assistant message", async () => {
    const session = await createStoredSession(tmpRoot);
    const vision = makeVisionModel();
    const text = makeTextModel(async () =>
      okResult(approveDecisionJson("Dzień dobry.\n\nDecyzja: pozytywna dla zgłoszenia.")),
    );
    testModels.vision = vision.model;
    testModels.text = text.model;

    const res = await callAnalyze(session.id);
    const body = (await res.json()) as {
      sessionId: string;
      decision: { decision: string; source: string; guardOverride: boolean };
    };

    expect(res.status).toBe(200);
    expect(body.sessionId).toBe(session.id);
    expect(body.decision.decision).toBe("APPROVE");
    expect(body.decision.source).toBe("initial");
    expect(body.decision.guardOverride).toBe(false);

    const history = getSessionWithHistory(getDb(), session.id);
    expect(history?.session.status).toBe("analyzed");
    expect(history?.session.visionAnalysis).not.toBeNull();
    expect(history?.decisions).toHaveLength(1);
    expect(history?.decisions[0]?.source).toBe("initial");
    expect(history?.messages).toHaveLength(1);
    expect(history?.messages[0]?.role).toBe("assistant");

    const parts = parseTextParts(history?.messages[0]?.parts ?? "[]");
    expect(parts[0]?.text).toContain("Decyzja: pozytywna");
    expect(parts[0]?.text?.length ?? 0).toBeGreaterThan(0);
    expect(vision.doGenerate).toHaveBeenCalledTimes(1);
    expect(text.doGenerate).toHaveBeenCalledTimes(1);
  });

  it("returns the already persisted initial decision without additional LLM calls", async () => {
    const session = await createStoredSession(tmpRoot);
    const vision = makeVisionModel();
    const text = makeTextModel();
    testModels.vision = vision.model;
    testModels.text = text.model;

    const firstRes = await callAnalyze(session.id);
    const firstBody = (await firstRes.json()) as {
      sessionId: string;
      decision: { id: number; decision: string; source: string };
    };
    const visionCallsBefore = vision.doGenerate.mock.calls.length;
    const textCallsBefore = text.doGenerate.mock.calls.length;

    const secondRes = await callAnalyze(session.id);
    const secondBody = (await secondRes.json()) as typeof firstBody;

    expect(secondRes.status).toBe(200);
    expect(secondBody).toEqual(firstBody);
    expect(vision.doGenerate).toHaveBeenCalledTimes(visionCallsBefore);
    expect(text.doGenerate).toHaveBeenCalledTimes(textCallsBefore);
    expect(vision.doGenerate).toHaveBeenCalledTimes(1);
    expect(text.doGenerate).toHaveBeenCalledTimes(1);

    const history = getSessionWithHistory(getDb(), session.id);
    expect(history?.decisions).toHaveLength(1);
    expect(history?.messages).toHaveLength(1);
  });

  it("marks LLM failure as retryable and preserves the session for a later successful retry", async () => {
    const session = await createStoredSession(tmpRoot);
    const failingVision = makeVisionModel(async () => {
      throw new Error("persistently down");
    });
    const text = makeTextModel();
    testModels.vision = failingVision.model;
    testModels.text = text.model;

    const failedRes = await callAnalyze(session.id);
    expect(failedRes.status).toBe(502);
    await expect(failedRes.json()).resolves.toEqual({
      error: pl.errorBanner.retry.message,
    });

    const failedHistory = getSessionWithHistory(getDb(), session.id);
    expect(failedHistory?.session.status).toBe("analysis_failed");
    expect(failedHistory?.session.productName).toBe(session.productName);
    expect(failedHistory?.session.purchaseDate).toBe(session.purchaseDate);
    expect(failedHistory?.session.reason).toBe(session.reason);
    expect(failedHistory?.session.imagePath).toBe(session.imagePath);
    expect(failedHistory?.decisions).toHaveLength(0);
    expect(failedHistory?.messages).toHaveLength(0);
    expect(failingVision.doGenerate).toHaveBeenCalledTimes(2);
    expect(text.doGenerate).not.toHaveBeenCalled();

    const retryVision = makeVisionModel();
    testModels.vision = retryVision.model;

    const retryRes = await callAnalyze(session.id);
    expect(retryRes.status).toBe(200);

    const retryHistory = getSessionWithHistory(getDb(), session.id);
    expect(retryHistory?.session.status).toBe("analyzed");
    expect(retryHistory?.decisions).toHaveLength(1);
  });

  it("persists an ESCALATE decision and photo-not-assessable message for an unusable image", async () => {
    const session = await createStoredSession(tmpRoot);
    const vision = makeVisionModel(async () => okResult(unusableVisionJson()));
    const text = makeTextModel();
    testModels.vision = vision.model;
    testModels.text = text.model;

    const res = await callAnalyze(session.id);
    const body = (await res.json()) as {
      sessionId: string;
      decision: { decision: string };
    };

    expect(res.status).toBe(200);
    expect(body.sessionId).toBe(session.id);
    expect(body.decision.decision).toBe("ESCALATE");

    const history = getSessionWithHistory(getDb(), session.id);
    expect(history?.decisions[0]?.guardOverride).toBe(true);
    const parts = parseTextParts(history?.messages[0]?.parts ?? "[]");
    expect(parts[0]?.text).toContain("nie udało się ocenić przesłanego zdjęcia");
  });

  it("persists guardOverride=false when the initial decision is not guard-rewritten", async () => {
    const session = await createStoredSession(tmpRoot);
    const vision = makeVisionModel();
    const text = makeTextModel();
    testModels.vision = vision.model;
    testModels.text = text.model;

    const res = await callAnalyze(session.id);
    const body = (await res.json()) as {
      decision: { decision: string; guardOverride: boolean };
    };

    expect(res.status).toBe(200);
    expect(body.decision.decision).toBe("APPROVE");
    expect(body.decision.guardOverride).toBe(false);

    const history = getSessionWithHistory(getDb(), session.id);
    expect(history?.decisions[0]?.guardOverride).toBe(false);
  });
});
