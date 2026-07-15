import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDb, type DbHandle } from "./client";
import {
  AlreadyAnalyzedError,
  appendDecision,
  appendMessage,
  completeAnalysis,
  createSession,
  getSessionWithHistory,
  markAnalysisFailed,
  SessionNotFoundError,
  type ValidatedSessionForm,
} from "./repositories";
import { messages } from "./schema";

function baseForm(): ValidatedSessionForm {
  return {
    requestType: "complaint",
    category: "smartphone",
    productName: "Test Phone",
    purchaseDate: "2026-01-01",
    reason: "Screen cracked",
  };
}

function baseImageMeta() {
  return {
    imagePath: "data/uploads/test.jpg",
    imageOriginalName: "original.jpg",
    imageMediaType: "image/jpeg",
  };
}

/** Deterministic, strictly-increasing clock for ordering assertions. */
function fakeClock(start = 1000) {
  let current = start;
  return () => current++;
}

describe("session repositories (ADR-003 §5, §8)", () => {
  let handle: DbHandle;

  beforeEach(() => {
    handle = createDb({ filePath: ":memory:" });
  });

  afterEach(() => {
    handle.close();
  });

  describe("createSession", () => {
    it("creates a session with status created and a non-enumerable ID", () => {
      const session = createSession(handle.db, baseForm(), baseImageMeta());

      expect(session.status).toBe("created");
      // nanoid default alphabet, ~21 chars — not a small enumerable integer.
      expect(session.id).toMatch(/^[A-Za-z0-9_-]{15,}$/);
      expect(session.productName).toBe("Test Phone");
      expect(session.reason).toBe("Screen cracked");
    });

    it("generates a different ID on each call (no collisions in practice)", () => {
      const first = createSession(handle.db, baseForm(), baseImageMeta());
      const second = createSession(handle.db, baseForm(), baseImageMeta());
      expect(first.id).not.toBe(second.id);
    });
  });

  describe("completeAnalysis", () => {
    it("atomically persists visionAnalysis, status, initial decision and first message", () => {
      const session = createSession(handle.db, baseForm(), baseImageMeta());

      completeAnalysis(
        handle.db,
        session.id,
        { damage: "cracked screen" },
        { decision: "APPROVE", justification: "Within warranty", citedRuleIds: ["R1"] },
        { id: "msg-1", parts: [{ type: "text", text: "Decyzja: zatwierdzono" }] },
      );

      const history = getSessionWithHistory(handle.db, session.id);
      expect(history?.session.status).toBe("analyzed");
      expect(history?.session.visionAnalysis).toBe(JSON.stringify({ damage: "cracked screen" }));
      expect(history?.decisions).toHaveLength(1);
      expect(history?.decisions[0].source).toBe("initial");
      expect(history?.decisions[0].previousDecision).toBeNull();
      expect(history?.decisions[0].citedRuleIds).toBe(JSON.stringify(["R1"]));
      expect(history?.messages).toHaveLength(1);
      expect(history?.messages[0].role).toBe("assistant");
      expect(history?.messages[0].id).toBe("msg-1");
    });

    it("throws AlreadyAnalyzedError on a second call and leaves a single decision/message row", () => {
      const session = createSession(handle.db, baseForm(), baseImageMeta());
      const decisionInput = { decision: "APPROVE" as const, justification: "ok", citedRuleIds: [] };

      completeAnalysis(handle.db, session.id, {}, decisionInput, { id: "msg-1", parts: [] });

      expect(() =>
        completeAnalysis(handle.db, session.id, {}, decisionInput, { id: "msg-2", parts: [] }),
      ).toThrow(AlreadyAnalyzedError);

      const history = getSessionWithHistory(handle.db, session.id);
      expect(history?.decisions).toHaveLength(1);
      expect(history?.messages).toHaveLength(1);
      expect(history?.session.status).toBe("analyzed");
    });

    it("throws SessionNotFoundError for an unknown session", () => {
      expect(() =>
        completeAnalysis(
          handle.db,
          "does-not-exist",
          {},
          { decision: "APPROVE", justification: "x", citedRuleIds: [] },
          { id: "m", parts: [] },
        ),
      ).toThrow(SessionNotFoundError);
    });

    it("rolls back the whole transaction when the message insert fails (real PK violation, no mocks)", () => {
      const session = createSession(handle.db, baseForm(), baseImageMeta());

      // Genuinely occupy the message ID the transaction will try to insert,
      // forcing a real PRIMARY KEY violation on the message-insert step.
      handle.db
        .insert(messages)
        .values({ id: "clash", sessionId: session.id, role: "user", parts: "[]", createdAt: 1 })
        .run();

      expect(() =>
        completeAnalysis(
          handle.db,
          session.id,
          {},
          { decision: "APPROVE", justification: "x", citedRuleIds: [] },
          { id: "clash", parts: [] },
        ),
      ).toThrow();

      const history = getSessionWithHistory(handle.db, session.id);
      // Status update and decision insert must have rolled back too — never
      // half-analyzed (ADR-003 §6 D3-02 / TAC-003-04).
      expect(history?.session.status).toBe("created");
      expect(history?.session.visionAnalysis).toBeNull();
      expect(history?.decisions).toHaveLength(0);
      expect(history?.messages).toHaveLength(1);
    });
  });

  describe("markAnalysisFailed", () => {
    it("flips status to analysis_failed without touching form data or image", () => {
      const session = createSession(handle.db, baseForm(), baseImageMeta());
      markAnalysisFailed(handle.db, session.id);

      const history = getSessionWithHistory(handle.db, session.id);
      expect(history?.session.status).toBe("analysis_failed");
      expect(history?.session.productName).toBe("Test Phone");
      expect(history?.session.imagePath).toBe("data/uploads/test.jpg");
    });

    it("allows a subsequent completeAnalysis retry to succeed", () => {
      const session = createSession(handle.db, baseForm(), baseImageMeta());
      markAnalysisFailed(handle.db, session.id);

      completeAnalysis(
        handle.db,
        session.id,
        {},
        { decision: "APPROVE", justification: "x", citedRuleIds: [] },
        { id: "msg-1", parts: [] },
      );

      const history = getSessionWithHistory(handle.db, session.id);
      expect(history?.session.status).toBe("analyzed");
    });
  });

  describe("appendDecision (append-only, ADR-000 AC-26)", () => {
    it("chains previousDecision across revisions and records guardOverride", () => {
      const clock = fakeClock();
      const session = createSession(handle.db, baseForm(), baseImageMeta(), clock);
      completeAnalysis(
        handle.db,
        session.id,
        {},
        { decision: "APPROVE", justification: "initial", citedRuleIds: ["R1"] },
        { id: "msg-1", parts: [] },
        clock,
      );

      const revision1 = appendDecision(
        handle.db,
        session.id,
        { decision: "MORE_INFO", justification: "need receipt", citedRuleIds: ["R2"], source: "chat_revision" },
        clock,
      );

      const revision2 = appendDecision(
        handle.db,
        session.id,
        {
          decision: "REJECT",
          justification: "receipt shows out of warranty",
          citedRuleIds: ["R3"],
          source: "chat_revision",
          guardOverride: true,
        },
        clock,
      );

      const history = getSessionWithHistory(handle.db, session.id);
      expect(history?.decisions).toHaveLength(3);
      expect(history?.decisions[0].decision).toBe("APPROVE");
      expect(history?.decisions[0].previousDecision).toBeNull();
      expect(revision1.previousDecision).toBe("APPROVE");
      expect(revision1.source).toBe("chat_revision");
      expect(revision2.previousDecision).toBe("MORE_INFO");
      expect(revision2.guardOverride).toBe(true);
      expect(history?.decisions[0].guardOverride).toBe(false);
    });

    it("orders decisions by autoincrement id even with identical timestamps", () => {
      const sameInstant = () => 1234;
      const session = createSession(handle.db, baseForm(), baseImageMeta(), sameInstant);
      completeAnalysis(
        handle.db,
        session.id,
        {},
        { decision: "APPROVE", justification: "a", citedRuleIds: [] },
        { id: "msg-1", parts: [] },
        sameInstant,
      );
      appendDecision(
        handle.db,
        session.id,
        { decision: "MORE_INFO", justification: "b", citedRuleIds: [], source: "chat_revision" },
        sameInstant,
      );
      appendDecision(
        handle.db,
        session.id,
        { decision: "ESCALATE", justification: "c", citedRuleIds: [], source: "chat_revision" },
        sameInstant,
      );

      const history = getSessionWithHistory(handle.db, session.id);
      expect(history?.decisions.map((d) => d.decision)).toEqual(["APPROVE", "MORE_INFO", "ESCALATE"]);
      const ids = history!.decisions.map((d) => d.id);
      expect(ids).toEqual([...ids].sort((a, b) => a - b));
    });
  });

  describe("appendMessage (upsert-by-ID)", () => {
    it("persisting the same UI message twice results in one row (retry-safe)", () => {
      const session = createSession(handle.db, baseForm(), baseImageMeta());
      completeAnalysis(
        handle.db,
        session.id,
        {},
        { decision: "APPROVE", justification: "x", citedRuleIds: [] },
        { id: "assistant-1", parts: [] },
      );

      appendMessage(handle.db, session.id, {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "Cześć" }],
      });
      appendMessage(handle.db, session.id, {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "Cześć, zmieniona wiadomość" }],
      });

      const history = getSessionWithHistory(handle.db, session.id);
      const userMessages = history!.messages.filter((m) => m.id === "user-1");
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].parts).toBe(
        JSON.stringify([{ type: "text", text: "Cześć, zmieniona wiadomość" }]),
      );
    });
  });

  describe("getSessionWithHistory", () => {
    it("returns null for an unknown session", () => {
      expect(getSessionWithHistory(handle.db, "does-not-exist")).toBeNull();
    });

    it("returns messages and decisions strictly time-ordered for interleaved inserts", () => {
      const clock = fakeClock();
      const session = createSession(handle.db, baseForm(), baseImageMeta(), clock);
      completeAnalysis(
        handle.db,
        session.id,
        {},
        { decision: "APPROVE", justification: "x", citedRuleIds: [] },
        { id: "assistant-1", parts: [] },
        clock,
      );

      appendMessage(handle.db, session.id, { id: "user-1", role: "user", parts: [] }, clock);
      appendDecision(
        handle.db,
        session.id,
        { decision: "MORE_INFO", justification: "y", citedRuleIds: [], source: "chat_revision" },
        clock,
      );
      appendMessage(handle.db, session.id, { id: "assistant-2", role: "assistant", parts: [] }, clock);

      const history = getSessionWithHistory(handle.db, session.id);
      expect(history!.messages.map((m) => m.id)).toEqual(["assistant-1", "user-1", "assistant-2"]);
      expect(history!.decisions.map((d) => d.decision)).toEqual(["APPROVE", "MORE_INFO"]);
    });

    it("handles an empty chat (only the first assistant message)", () => {
      const session = createSession(handle.db, baseForm(), baseImageMeta());
      completeAnalysis(
        handle.db,
        session.id,
        {},
        { decision: "APPROVE", justification: "x", citedRuleIds: [] },
        { id: "assistant-1", parts: [] },
      );

      const history = getSessionWithHistory(handle.db, session.id);
      expect(history!.messages).toHaveLength(1);
      expect(history!.decisions).toHaveLength(1);
    });
  });
});
