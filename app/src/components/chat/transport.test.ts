import { describe, expect, it } from "vitest";

import type { UIMessage } from "ai";

import {
  CHAT_API_PATH,
  buildRequestBody,
  createChatTransport,
  type ChatRequestBody,
} from "./transport";

/**
 * Transport request-prep unit tests (ADR-000 D8: server is the source of truth
 * for chat history; the client sends ONLY { sessionId, newest user message }).
 *
 * These tests target the pure `buildRequestBody` function so they stay trivial
 * to reason about — no React, no stream construction, no network.
 */
function userMsg(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function assistantMsg(id: string, text: string): UIMessage {
  return { id, role: "assistant", parts: [{ type: "text", text }] };
}

describe("buildRequestBody (ADR-000 D8 — server owns history)", () => {
  it("sends only { sessionId, message, trigger } for a new user message", () => {
    // The transport hook receives the full client-side messages array (the
    // SDK populates it automatically). D8 forbids sending it onward: the
    // server reloads the transcript from the DB.
    const messages: UIMessage[] = [
      assistantMsg("a1", "Witaj! Oto Twoja decyzja…"),
      userMsg("u1", "Czy mogę dodać fakturę?"),
      assistantMsg("a2", "Tak, proszę opisać szczegóły."),
      userMsg("u2", "Mam paragon z wczoraj"), // newest — this is what we must send
    ];

    const result = buildRequestBody({
      id: "sess-123",
      messages,
      trigger: "submit-message",
    });

    const expected: ChatRequestBody = {
      sessionId: "sess-123",
      message: "Mam paragon z wczoraj",
      trigger: "submit-message",
    };
    expect(result.body).toEqual(expected);
  });

  it("does NOT include the full messages array in the body", () => {
    const messages: UIMessage[] = [
      userMsg("u1", "one"),
      assistantMsg("a1", "two"),
      userMsg("u2", "three"),
    ];

    const result = buildRequestBody({
      id: "sess-123",
      messages,
      trigger: "submit-message",
    });

    // The body must be the minimal D8 contract — no history leak.
    expect(result.body).not.toHaveProperty("messages");
    expect(Object.keys(result.body).sort()).toEqual(
      ["message", "sessionId", "trigger"].sort(),
    );
  });

  it("uses the chat `id` as the sessionId (chat id === sessionId per ADR-002)", () => {
    const result = buildRequestBody({
      id: "abc-456",
      messages: [userMsg("u1", "hi")],
      trigger: "submit-message",
    });
    expect(result.body.sessionId).toBe("abc-456");
  });

  it("joins multiple text parts of the newest user message into one string", () => {
    const messages: UIMessage[] = [
      {
        id: "u1",
        role: "user",
        parts: [
          { type: "text", text: "Cześć, " },
          { type: "text", text: "mam pytanie" },
        ],
      },
    ];

    const result = buildRequestBody({
      id: "sess",
      messages,
      trigger: "submit-message",
    });

    expect(result.body.message).toBe("Cześć, mam pytanie");
  });

  it("sends message: null for a regenerate-message trigger (no new user text)", () => {
    // AC-24 retry path: regenerate must not re-send any user text. The server
    // reloads history and regenerates the last assistant turn for the session.
    const messages: UIMessage[] = [
      userMsg("u1", "pytanie"),
      assistantMsg("a1", "odpowiedź"),
    ];

    const result = buildRequestBody({
      id: "sess-789",
      messages,
      trigger: "regenerate-message",
    });

    expect(result.body.message).toBeNull();
    expect(result.body.trigger).toBe("regenerate-message");
    expect(result.body.sessionId).toBe("sess-789");
  });

  it("falls back to message: null when the newest user message has no text part", () => {
    const messages: UIMessage[] = [
      // Defensive: a malformed/edge newest user message with no text part.
      { id: "u1", role: "user", parts: [] },
    ];

    const result = buildRequestBody({
      id: "sess",
      messages,
      trigger: "submit-message",
    });

    expect(result.body.message).toBeNull();
  });
});

describe("createChatTransport", () => {
  it("returns a ChatTransport that POSTs to the canonical /api/chat endpoint", () => {
    const transport = createChatTransport();
    // The transport object exists and exposes the ChatTransport interface.
    expect(typeof transport.sendMessages).toBe("function");
    expect(typeof transport.reconnectToStream).toBe("function");
  });

  it("exports the canonical API path the server route handler (T3.3) must match", () => {
    expect(CHAT_API_PATH).toBe("/api/chat");
  });
});
