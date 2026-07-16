/**
 * @vitest-environment node
 *
 * Integration tests for GET /api/sessions/:id (ADR-000 section 6, AC-27).
 *
 * Real SQLite; no mocks of deps. The GET handler is invoked directly with a
 * constructed Request and a Promise-wrapped params object (the Next 16
 * dynamic-route signature). Sessions are seeded via the repository functions.
 *
 * DB isolation uses the same getDb-mock pattern as the POST tests
 * (see route.test.ts header for rationale). No chdir is needed here: GET
 * never touches the filesystem.
 */
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppDatabase } from "@/lib/db/client";
import {
  appendDecision,
  appendMessage,
  completeAnalysis,
  createSession,
  type SessionImageMeta,
  type ValidatedSessionForm,
} from "@/lib/db/repositories";

import { GET } from "./route";

const APP_ROOT = process.cwd();
const DRIZZLE_DIR = path.join(APP_ROOT, "drizzle");

const testDb = vi.hoisted<{
  db: AppDatabase | null;
  close: (() => void) | null;
}>(() => ({ db: null, close: null }));

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

const { createDb, getDb } = await import("@/lib/db/client");

function baseForm(overrides: Partial<ValidatedSessionForm> = {}): ValidatedSessionForm {
  return {
    requestType: "complaint",
    category: "smartphone",
    productName: "iPhone 15 Pro",
    purchaseDate: "2026-01-15",
    reason: "Ekran pękł po upadku.",
    ...overrides,
  };
}

function baseImageMeta(): SessionImageMeta {
  return {
    imagePath: "data/uploads/fixture.jpg",
    imageOriginalName: "photo.png",
    imageMediaType: "image/png",
  };
}

/** Deterministic, strictly-increasing clock for ordering assertions. */
function fakeClock(start = 1_700_000_000) {
  let current = start;
  return () => current++;
}

async function callGet(sessionId: string): Promise<Response> {
  const request = new Request(`http://localhost/api/sessions/${sessionId}`);
  const context = { params: Promise.resolve({ id: sessionId }) };
  return GET(request, context);
}

describe("GET /api/sessions/:id (AC-25..AC-27)", () => {
  beforeEach(() => {
    const handle = createDb({
      filePath: ":memory:",
      migrationsFolder: DRIZZLE_DIR,
    });
    testDb.db = handle.db;
    testDb.close = handle.close;
  });

  afterEach(() => {
    testDb.close?.();
    testDb.db = null;
    testDb.close = null;
  });

  it("returns 404 for an unknown session id", async () => {
    const res = await callGet("does-not-exist");
    expect(res.status).toBe(404);
  });

  it("returns 200 with the form summary for a freshly created session", async () => {
    const session = createSession(getDb(), baseForm(), baseImageMeta());

    const res = await callGet(session.id);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.id).toBe(session.id);
    expect(body.requestType).toBe("complaint");
    expect(body.category).toBe("smartphone");
    expect(body.productName).toBe("iPhone 15 Pro");
    expect(body.purchaseDate).toBe("2026-01-15");
    expect(body.reason).toBe("Ekran pękł po upadku.");
    expect(body.status).toBe("created");
    expect(body.imageMediaType).toBe("image/png");
    expect(body.imageOriginalName).toBe("photo.png");
    expect(body.imagePath).toBe("data/uploads/fixture.jpg");
  });

  it("returns empty decisions and messages arrays for a fresh session", async () => {
    const session = createSession(getDb(), baseForm(), baseImageMeta());

    const res = await callGet(session.id);
    const body = (await res.json()) as { decisions: unknown[]; messages: unknown[] };
    expect(body.decisions).toEqual([]);
    expect(body.messages).toEqual([]);
  });

  it("returns decisions ordered by id with parsed metadata", async () => {
    const clock = fakeClock();
    const session = createSession(getDb(), baseForm(), baseImageMeta(), clock);
    completeAnalysis(
      getDb(),
      session.id,
      {},
      { decision: "APPROVE", justification: "ok", citedRuleIds: ["R1"] },
      { id: "msg-1", parts: [{ type: "text", text: "decyzja" }] },
      clock,
    );
    appendDecision(
      getDb(),
      session.id,
      {
        decision: "MORE_INFO",
        justification: "potrzebuję paragonu",
        citedRuleIds: ["R2", "R3"],
        source: "chat_revision",
      },
      clock,
    );

    const res = await callGet(session.id);
    const body = (await res.json()) as { decisions: Array<Record<string, unknown>> };
    expect(body.decisions).toHaveLength(2);
    expect(body.decisions[0]!.decision).toBe("APPROVE");
    expect(body.decisions[0]!.previousDecision).toBeNull();
    expect(body.decisions[0]!.citedRuleIds).toEqual(["R1"]);
    expect(body.decisions[0]!.source).toBe("initial");
    expect(body.decisions[1]!.decision).toBe("MORE_INFO");
    expect(body.decisions[1]!.previousDecision).toBe("APPROVE");
    // citedRuleIds must be parsed to an array, not left as a JSON string.
    expect(Array.isArray(body.decisions[1]!.citedRuleIds)).toBe(true);
    expect(body.decisions[1]!.citedRuleIds).toEqual(["R2", "R3"]);
    expect(body.decisions[1]!.source).toBe("chat_revision");
  });

  it("returns messages in UI-message format (id, role, parsed parts) ordered by createdAt (AC-27)", async () => {
    const clock = fakeClock();
    const session = createSession(getDb(), baseForm(), baseImageMeta(), clock);
    completeAnalysis(
      getDb(),
      session.id,
      {},
      { decision: "APPROVE", justification: "ok", citedRuleIds: [] },
      { id: "assistant-1", parts: [{ type: "text", text: "Decyzja: zatwierdzono." }] },
      clock,
    );
    appendMessage(getDb(), session.id, {
      id: "user-1",
      role: "user",
      parts: [{ type: "text", text: "Dziękuję." }],
    });

    const res = await callGet(session.id);
    const body = (await res.json()) as { messages: Array<Record<string, unknown>> };
    expect(body.messages.map((m) => m.id)).toEqual(["assistant-1", "user-1"]);
    expect(body.messages[0]!.role).toBe("assistant");
    expect(Array.isArray(body.messages[0]!.parts)).toBe(true);
    expect(body.messages[0]!.parts).toEqual([{ type: "text", text: "Decyzja: zatwierdzono." }]);
    expect(body.messages[1]!.role).toBe("user");
    expect(body.messages[1]!.parts).toEqual([{ type: "text", text: "Dziękuję." }]);
  });

  it("returns createdAt as a number on the session and on every nested row", async () => {
    const clock = fakeClock();
    const session = createSession(getDb(), baseForm(), baseImageMeta(), clock);
    completeAnalysis(
      getDb(),
      session.id,
      {},
      { decision: "APPROVE", justification: "ok", citedRuleIds: [] },
      { id: "msg-1", parts: [] },
      clock,
    );

    const res = await callGet(session.id);
    const body = (await res.json()) as {
      createdAt: number;
      decisions: Array<{ createdAt: number }>;
      messages: Array<{ createdAt: number }>;
    };
    expect(typeof body.createdAt).toBe("number");
    expect(typeof body.decisions[0]!.createdAt).toBe("number");
    expect(typeof body.messages[0]!.createdAt).toBe("number");
  });
});
