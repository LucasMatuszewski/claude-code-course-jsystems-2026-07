"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { pl } from "@/lib/i18n/pl";
import { useChat } from "@ai-sdk/react";
import type { ChatTransport, ChatStatus, UIMessage } from "ai";
import Link from "next/link";
import { useMemo } from "react";
import { ChatInput } from "./ChatInput";
import { MessageRow } from "./MessageRow";
import { createChatTransport } from "./transport";

/**
 * Chat screen shell (PRD §9.2; AC-18/AC-20/AC-23/AC-24/AC-27).
 *
 * Built on the AI Elements `Conversation` + `Message` primitives (ADR-002 D2-01)
 * and the AI SDK `useChat` hook. The server is the source of truth for history
 * (ADR-000 D8): the transport sends only `{ sessionId, message, trigger }`, and
 * the restored transcript comes from the server component as `messages`.
 *
 * This is the component task T4.5 (`/chat/[sessionId]`) will mount:
 *
 *   <ChatView sessionId={params.sessionId} messages={restored} />
 *
 * Decision badges, the revision marker, and the not-found branch are T4.5 and
 * are NOT rendered here — message parts are rendered generically (text →
 * markdown) and unknown part types are tolerated silently (MessageRow).
 */
export type ChatViewProps = {
  /** Session id; used as the `useChat` chat id (ADR-002 §3). */
  sessionId: string;
  /**
   * Restored transcript from the server component (AC-27). Pass the UI-message
   * array returned by GET /api/sessions/:id (server-side fetch in T4.5).
   * Defaults to `[]` for a freshly-created session with only the persisted
   * first decision message already present.
   */
  messages?: UIMessage[];
  /**
   * Transport override. Production callers omit this (defaults to
   * `createChatTransport()`, which POSTs to `/api/chat` and sends only the D8
   * minimal body). Tests inject a fake to avoid hitting a real endpoint.
   */
  transport?: ChatTransport<UIMessage>;
};

function isStreaming(status: ChatStatus): boolean {
  return status === "submitted" || status === "streaming";
}

export function ChatView({ sessionId, messages, transport }: ChatViewProps) {
  const resolvedTransport = useMemo(
    () => transport ?? createChatTransport(),
    [transport],
  );

  const chat = useChat({
    id: sessionId,
    messages: messages ?? [],
    transport: resolvedTransport,
  });

  const streaming = isStreaming(chat.status);
  const hasError = chat.status === "error";

  function handleSend(text: string) {
    // Stamp the client-clock timestamp on the live user message (PRD §9.2).
    // The assistant reply's timestamp arrives with persistence on next reload
    // (AC-27); live assistant bubbles render without one until then.
    void chat.sendMessage({
      text,
      metadata: { createdAt: new Date().toISOString() },
    });
  }

  function handleRetry() {
    // AC-24: regenerate the failed assistant turn. Per D8, only
    // `{ sessionId, message: null, trigger: 'regenerate-message' }` is sent;
    // the server reloads full history and regenerates the last reply.
    void chat.regenerate();
  }

  return (
    <div className="bg-background flex h-full flex-col">
      <header className="border-border-strong bg-background-light flex items-center justify-between gap-md border-b px-lg py-sm">
        <div className="flex flex-col">
          <span className="text-text-secondary text-xs">
            {pl.chat.header.sessionIdLabel}
          </span>
          <span className="text-sm font-semibold" data-testid="chat-session-id">
            {sessionId}
          </span>
        </div>
        <Link
          href="/"
          className="text-brand-link text-sm font-medium hover:underline"
        >
          {pl.chat.header.newRequestLink}
        </Link>
      </header>

      <Conversation className="flex-1">
        <ConversationContent>
          {chat.messages.map((message) => (
            <MessageRow key={message.id} message={message} />
          ))}

          {streaming ? (
            <div className="flex w-full max-w-[95%] justify-start">
              <div className="bg-secondary flex w-fit items-center gap-2 rounded-[var(--radius-play-md)] px-md py-sm">
                {/* Spinner hardcodes role="status"; its Polish label overrides
                    the default English "Loading" via prop spread. */}
                <Spinner
                  aria-label={pl.chat.typingIndicatorLabel}
                  className="size-4"
                />
              </div>
            </div>
          ) : null}

          {hasError ? (
            <div
              role="alert"
              className="flex w-full max-w-[95%] justify-start"
            >
              <div className="border-destructive/30 bg-destructive/5 flex w-fit items-center gap-2 rounded-[var(--radius-play-md)] border px-md py-sm">
                <Button onClick={handleRetry} size="sm" variant="outline">
                  {pl.chat.retryButton}
                </Button>
              </div>
            </div>
          ) : null}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      <ChatInput onSend={handleSend} disabled={streaming} />
    </div>
  );
}
