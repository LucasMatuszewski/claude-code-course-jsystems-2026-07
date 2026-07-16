"use client";

/**
 * Read-only chat transcript for the reviewer case-detail page (PRD §9.3,
 * AC-42; ADR-004 §3/§7 component diagram: `TranscriptView (reused
 * DecisionBlock)`).
 *
 * Renders the DB-shaped `CaseDetail.messages` (`ChatMessage[]`, oldest to
 * newest — the chronological transcript order `getCaseWithHistory` already
 * returns) using the exact same message-part rendering as the live chat
 * screen (`components/chat/MessageParts.tsx`), so a `tool-submitDecision`
 * part renders as the identical status-coloured `DecisionBlock` here too.
 * Purely presentational — no interactive elements.
 */

import { ChatMessageView, toUIMessages } from "@/components/chat/MessageParts";

export interface TranscriptMessage {
  id: string;
  role: "user" | "assistant";
  parts: unknown[];
}

export function TranscriptView({ messages }: { messages: TranscriptMessage[] }) {
  const uiMessages = toUIMessages(messages);

  return (
    <div className="flex flex-col gap-4">
      {uiMessages.map((message) => (
        <ChatMessageView key={message.id} message={message} />
      ))}
    </div>
  );
}
