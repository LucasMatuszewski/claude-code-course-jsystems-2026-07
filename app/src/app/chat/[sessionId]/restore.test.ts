import { describe, expect, it } from "vitest";

import type { DecisionDataPart } from "@/components/chat/DecisionBlock";
import type { Decision, Message, Session } from "@/lib/db/schema";

import { buildChatMessages, type SessionHistory } from "./restore";

const CREATED_AT = 1_700_000_000_000;

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    requestType: "complaint",
    category: "laptop",
    productName: "Nexon X15",
    purchaseDate: "2026-07-01",
    reason: "Zawias jest uszkodzony.",
    imagePath: "data/uploads/session-1.jpg",
    imageOriginalName: "photo.jpg",
    imageMediaType: "image/jpeg",
    visionAnalysis: null,
    status: "analyzed",
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: 1,
    sessionId: "session-1",
    decision: "APPROVE",
    previousDecision: null,
    justification: "Fallback justification",
    citedRuleIds: JSON.stringify(["R-1"]),
    source: "initial",
    guardOverride: false,
    createdAt: CREATED_AT + 1,
    ...overrides,
  };
}

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "message-1",
    sessionId: "session-1",
    role: "assistant",
    parts: JSON.stringify([{ type: "text", text: "Dzień dobry.\n\nDecyzja: tak." }]),
    createdAt: CREATED_AT + 2,
    ...overrides,
  };
}

function history(overrides: Partial<SessionHistory> = {}): SessionHistory {
  return {
    session: session(),
    decisions: [decision()],
    messages: [message()],
    ...overrides,
  };
}

describe("buildChatMessages", () => {
  it("wraps the earliest assistant message with the initial decision data", () => {
    const [restored] = buildChatMessages(history());

    expect(restored).toBeDefined();
    expect(restored?.role).toBe("assistant");
    expect(restored?.parts).toHaveLength(1);

    const part = restored?.parts[0] as DecisionDataPart;
    expect(part.type).toBe("data-decision");
    expect(part.data.category).toBe("APPROVE");
    expect(part.data.messageMarkdown).toBe("Dzień dobry.\n\nDecyzja: tak.");
  });

  it("returns all messages in order and keeps non-initial parts parsed through", () => {
    const userParts = [{ type: "text", text: "Mam dodatkowe informacje." }];
    const assistantParts = [
      { type: "text", text: "Dziękuję za doprecyzowanie." },
      { type: "tool-other", state: "input-streaming" },
    ];

    const restored = buildChatMessages(
      history({
        messages: [
          message({ id: "assistant-1" }),
          message({
            id: "user-1",
            role: "user",
            parts: JSON.stringify(userParts),
            createdAt: CREATED_AT + 3,
          }),
          message({
            id: "assistant-2",
            role: "assistant",
            parts: JSON.stringify(assistantParts),
            createdAt: CREATED_AT + 4,
          }),
        ],
      }),
    );

    expect(restored.map((item) => item.id)).toEqual([
      "assistant-1",
      "user-1",
      "assistant-2",
    ]);
    expect(restored[1]?.parts).toEqual(userParts);
    expect(restored[2]?.parts).toEqual(assistantParts);
  });

  it("falls back gracefully for malformed or non-array stored parts", () => {
    const restored = buildChatMessages(
      history({
        messages: [
          message({ id: "assistant-1", parts: "{not-json" }),
          message({ id: "user-1", role: "user", parts: JSON.stringify({ type: "text" }) }),
          message({ id: "assistant-2", parts: "{also-not-json" }),
        ],
      }),
    );

    const initialPart = restored[0]?.parts[0] as DecisionDataPart;
    expect(initialPart.type).toBe("data-decision");
    expect(initialPart.data.messageMarkdown).toBe("Fallback justification");
    expect(restored[1]?.parts).toEqual([]);
    expect(restored[2]?.parts).toEqual([]);
  });

  it("passes messages through untouched when there is no initial decision", () => {
    const parts = [{ type: "text", text: "Zwykła wiadomość." }];

    const restored = buildChatMessages(
      history({
        decisions: [],
        messages: [message({ id: "assistant-1", parts: JSON.stringify(parts) })],
      }),
    );

    expect(restored).toHaveLength(1);
    expect(restored[0]?.parts).toEqual(parts);
  });

  it("sets metadata.createdAt to an ISO string for every message", () => {
    const restored = buildChatMessages(
      history({
        messages: [
          message({ id: "assistant-1", createdAt: CREATED_AT + 10 }),
          message({ id: "user-1", role: "user", createdAt: CREATED_AT + 20 }),
        ],
      }),
    );

    expect(restored[0]?.metadata?.createdAt).toBe(
      new Date(CREATED_AT + 10).toISOString(),
    );
    expect(restored[1]?.metadata?.createdAt).toBe(
      new Date(CREATED_AT + 20).toISOString(),
    );
  });

  it("returns an empty array when the session has no messages", () => {
    expect(buildChatMessages(history({ messages: [] }))).toEqual([]);
  });
});
