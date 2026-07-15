/**
 * `POST /api/cases/[caseId]/chat` — streaming chat turn for a case
 * (ADR-000 §6, §9.3; ADR-002 §3/§5; PRD AC-14, AC-21..25, AC-33).
 *
 * The HTTP boundary is thin: it resolves the `caseId` path param, parses the
 * AI SDK `useChat` transport body (`{ messages: UIMessage[] }`), and delegates
 * to `streamChatTurn`, which rebuilds context from SQLite, runs any re-upload
 * analysis, and returns the streamed UI-message response.
 *
 * ## Testability
 * `createChatPostHandler(deps)` is the dependency-injected seam, matching the
 * pattern established by the other routes: integration tests pass a temp
 * SQLite handle, a temp uploads dir, a temp policies dir, and mock models. The
 * exported `POST` wires the production `getDb()` + `createModels()`.
 */

import type { UIMessage } from "ai";

import { pl } from "@/lib/copy/pl";
import { createModels } from "@/lib/ai/providers";
import { getDb } from "@/lib/db/client";
import { streamChatTurn, type StreamChatDeps } from "@/lib/ai/stream-chat";

type RouteContext = { params: Promise<{ caseId: string }> };

/** DI factory: builds the `POST` handler from injectable dependencies. */
export function createChatPostHandler(deps: StreamChatDeps) {
  return async function POST(request: Request, context: RouteContext): Promise<Response> {
    const { caseId } = await context.params;

    let body: { messages?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: pl.errors.genericApi }, { status: 400 });
    }

    const messages = Array.isArray(body?.messages) ? (body.messages as UIMessage[]) : [];

    return streamChatTurn(deps, caseId, messages);
  };
}

/** Production handler: wires the shared DB connection and OpenRouter models. */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return createChatPostHandler({ db: getDb(), models: createModels() })(request, context);
}
