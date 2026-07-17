import { stat } from "node:fs/promises";
import path from "node:path";

import { convertToModelMessages, type ModelMessage, type UIMessage } from "ai";
import { nanoid } from "nanoid";

import { streamChatReply } from "@/lib/ai/chat";
import type { ChatSessionSummary } from "@/lib/ai/prompts";
import type { ImageAnalysis } from "@/lib/ai/types";
import { getDb } from "@/lib/db/client";
import {
  appendMessage,
  getSessionWithHistory,
  type SessionWithHistory,
} from "@/lib/db/repositories";
import type {
  Decision,
  DecisionCategory,
  EquipmentCategory,
  Message,
  MessageRole,
  RequestType,
} from "@/lib/db/schema";
import { loadPolicy, type PolicyRequestType } from "@/lib/policies";
import { chatMessageSchema } from "@/lib/validation";

/**
 * POST /api/chat (ADR-000 section 6 + D8, ADR-001 section 5, AC-18/19/24).
 *
 * The client (see `components/chat/transport.ts`) sends only
 * `{ sessionId, message, trigger }` — never the full message history. This
 * handler is the D8 enforcement point: it reloads the session's form data,
 * vision analysis, decision history, and full message transcript from the
 * DB on every turn, and streams the reply built from that server-side
 * context alone. Any other field the client sends (e.g. a fabricated
 * `messages` array) is never read, so a tampered client payload cannot
 * influence the model's context.
 *
 * Flow:
 *  1. Parse + minimally shape-check the body; malformed body -> 400.
 *  2. Look up the session; unknown id -> 404.
 *  3. Require `status === "analyzed"`; otherwise -> 409 (chat is not yet
 *     available for this session).
 *  4. For a `submit-message` turn, validate the message against the shared
 *     `chatMessageSchema` (400 + the exact Polish message on failure) and
 *     persist it as a user message BEFORE calling the model, so it survives
 *     a generation failure (ADR-000 D8).
 *  5. Reload the full history from the DB (now including the just-persisted
 *     user turn) and convert it to `ModelMessage[]` for `streamChatReply`.
 *  6. Stream the reply; persist the assistant message `onFinish` under a
 *     message id fixed up front so the live-rendered and persisted/restored
 *     message share the same id (ADR-003 "stable across live render and
 *     restore").
 *
 * Mid-stream model failures are NOT turned into an HTTP error status: per
 * ADR-000 section 6 they surface through the UI-message stream's error part
 * so `useChat` can render a retry affordance for that reply (AC-24).
 */

const SESSION_NOT_FOUND_ERROR = "Nie znaleziono sesji o podanym identyfikatorze.";
const SESSION_NOT_ANALYZED_ERROR =
  "Zgłoszenie nie zostało jeszcze przeanalizowane — czat będzie dostępny po wydaniu wstępnej decyzji.";
const MALFORMED_REQUEST_ERROR = "Nieprawidłowe żądanie czatu.";

type ChatTrigger = "submit-message" | "regenerate-message";

interface ChatRequestBody {
  sessionId?: unknown;
  message?: unknown;
  trigger?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  let rawBody: ChatRequestBody;
  try {
    rawBody = (await request.json()) as ChatRequestBody;
  } catch {
    return badRequest(MALFORMED_REQUEST_ERROR);
  }

  const sessionId = typeof rawBody.sessionId === "string" ? rawBody.sessionId : "";
  if (sessionId.length === 0) {
    return badRequest(MALFORMED_REQUEST_ERROR);
  }

  const trigger: ChatTrigger =
    rawBody.trigger === "regenerate-message" ? "regenerate-message" : "submit-message";

  const db = getDb();

  const history = getSessionWithHistory(db, sessionId);
  if (history === null) {
    return notFoundResponse();
  }

  if (history.session.status !== "analyzed") {
    return Response.json({ error: SESSION_NOT_ANALYZED_ERROR }, { status: 409 });
  }

  if (trigger === "submit-message") {
    const parsedMessage = chatMessageSchema.safeParse(rawBody.message);
    if (!parsedMessage.success) {
      return badRequest(parsedMessage.error.issues[0]?.message ?? MALFORMED_REQUEST_ERROR);
    }

    // Persisted BEFORE generation so the user's turn survives a failed
    // model call (ADR-000 D8).
    appendMessage(db, sessionId, {
      id: nanoid(),
      role: "user",
      parts: [{ type: "text", text: parsedMessage.data }],
    });
  }

  // Rebuild the FULL context from the DB — this is what D8 requires. Any
  // other field on the request body (a tampered client history, etc.) is
  // never consulted from here on.
  const rebuilt = getSessionWithHistory(db, sessionId);
  if (rebuilt === null) {
    return notFoundResponse();
  }

  const sessionSummary = await buildChatSessionSummary(rebuilt);
  const modelMessages = await toModelMessages(rebuilt.messages);

  const assistantMessageId = nanoid();

  const result = streamChatReply(sessionSummary, modelMessages, {
    db,
    onFinish: async ({ text }) => {
      appendMessage(db, sessionId, {
        id: assistantMessageId,
        role: "assistant",
        parts: [{ type: "text", text }],
      });
    },
  });

  return result.toUIMessageStreamResponse({
    generateMessageId: () => assistantMessageId,
  });
}

// --- Context rebuild (D8) ----------------------------------------------------

/** Reads the stored image's byte size for the informational form block in the chat prompt. Never reads file contents (no image bytes ever reach the chat model, ADR-001 TAC-001-04). Missing/unreadable file (e.g. test fixtures) falls back to 0 rather than failing the chat turn. */
async function resolveImageSizeBytes(imagePath: string): Promise<number> {
  try {
    const stats = await stat(path.resolve(/* turbopackIgnore: true */ process.cwd(), imagePath));
    return stats.size;
  } catch {
    return 0;
  }
}

function parseVisionAnalysis(raw: string | null, sessionId: string): ImageAnalysis {
  if (raw === null) {
    throw new Error(
      `Analyzed session "${sessionId}" is missing its vision analysis (invariant violation).`,
    );
  }
  return JSON.parse(raw) as ImageAnalysis;
}

async function buildChatSessionSummary(history: SessionWithHistory): Promise<ChatSessionSummary> {
  const { session, decisions } = history;
  const imageSizeBytes = await resolveImageSizeBytes(session.imagePath);

  return {
    form: {
      requestType: session.requestType as RequestType,
      category: session.category as EquipmentCategory,
      productName: session.productName,
      purchaseDate: session.purchaseDate,
      reason: session.reason ?? undefined,
      image: { type: session.imageMediaType, size: imageSizeBytes },
    },
    analysis: parseVisionAnalysis(session.visionAnalysis, session.id),
    decisionHistory: decisions.map(toDecisionHistoryEntry),
    policyProse: loadPolicy(session.requestType as PolicyRequestType).prose,
    sessionId: session.id,
  };
}

function toDecisionHistoryEntry(decision: Decision): ChatSessionSummary["decisionHistory"][number] {
  return {
    category: decision.decision as DecisionCategory,
    justification: decision.justification,
    timestamp: new Date(decision.createdAt).toISOString(),
  };
}

/** Parses a stored message's UI-message parts JSON; falls back to an empty array on corruption rather than throwing, mirroring GET /api/sessions/:id's restore path. */
function parseMessageParts(raw: string): UIMessage["parts"] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UIMessage["parts"]) : [];
  } catch {
    return [];
  }
}

async function toModelMessages(messages: Message[]): Promise<ModelMessage[]> {
  const uiMessages = messages.map((message) => ({
    role: message.role as MessageRole,
    parts: parseMessageParts(message.parts),
  }));
  return convertToModelMessages(uiMessages);
}

// --- Response helpers ---------------------------------------------------------

function notFoundResponse(): Response {
  return Response.json({ error: SESSION_NOT_FOUND_ERROR }, { status: 404 });
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}
