import { DefaultChatTransport, type ChatTransport, type UIMessage } from "ai";

/**
 * Chat transport wiring (ADR-000 §6 + D8).
 *
 * The server is the source of truth for chat history: the client sends ONLY
 * `{ sessionId, message, trigger }` on each turn. The server reloads the full
 * transcript, decisions, form data, and vision analysis from the DB for every
 * turn (AC-19, AC-26, AC-27), and persists the incoming user message before
 * generation and the assistant message after completion. The client never
 * ships its full history over the wire.
 *
 * This module owns the contract that task T3.3 (POST /api/chat route handler)
 * consumes. Mocked at the unit level; not exercised against a live endpoint
 * in T4.4 (T3.3 lands later).
 */

/** Canonical endpoint the route handler (T3.3) must mount. */
export const CHAT_API_PATH = "/api/chat" as const;

/**
 * The two reasons the transport can fire a request. Mirrors the AI SDK's
 * `ChatTransport.sendMessages` `trigger` field verbatim.
 */
export type ChatTransportTrigger = "submit-message" | "regenerate-message";

/**
 * Minimal request body for POST /api/chat (ADR-000 D8).
 *
 * - `submit-message`: `message` is the text of the newest user message.
 * - `regenerate-message`: `message` is `null` — the server regenerates the
 *   last assistant turn for the session from persisted history (AC-24 retry).
 */
export type ChatRequestBody = {
  sessionId: string;
  message: string | null;
  trigger: ChatTransportTrigger;
};

/**
 * Extracts the text of the newest user message by joining its text parts.
 * Walks the array from the end so it costs O(1) on the common case (the last
 * message is the user's new one). Returns `null` when the newest user message
 * has no text (edge case: malformed message with no parts).
 */
function getNewestUserMessageText(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") {
      continue;
    }
    const text = message.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");
    return text.length > 0 ? text : null;
  }
  return null;
}

/**
 * Builds the minimal D8 request body from the SDK's prepareSendMessagesRequest
 * arguments. Exported (not just used inline) so it has a direct unit-test seam.
 *
 * The `id` the SDK passes here is the `useChat({ id })` value, which ChatView
 * sets to the session id (ADR-002 §3) — so `id` IS the session id.
 */
export function buildRequestBody({
  id,
  messages,
  trigger,
}: {
  id: string;
  messages: UIMessage[];
  trigger: ChatTransportTrigger;
}): { body: ChatRequestBody } {
  const message =
    trigger === "submit-message" ? getNewestUserMessageText(messages) : null;
  return { body: { sessionId: id, message, trigger } };
}

/**
 * Constructs the chat transport used by `useChat`. POSTs to `/api/chat` and
 * rewrites the default body (which would be the full messages array) down to
 * the D8 `{ sessionId, message, trigger }` contract via `buildRequestBody`.
 */
export function createChatTransport(): ChatTransport<UIMessage> {
  return new DefaultChatTransport({
    api: CHAT_API_PATH,
    prepareSendMessagesRequest: ({ id, messages, trigger }) =>
      buildRequestBody({ id, messages, trigger }),
  });
}
