"use client";

/**
 * Shared `UIMessage`-part rendering (ADR-004 §3/§7).
 *
 * Both the live chat screen (`ChatShell`) and the read-only reviewer
 * transcript (`components/reviewer/TranscriptView.tsx`) need a `text` part
 * to render as prose and a `tool-submitDecision` output part to render as
 * the same status-coloured `DecisionBlock` — extracted here once so the two
 * screens can never drift (ADR-004 §3 "reviewer detail... reusing the same
 * message-part rendering component as the chat page").
 *
 * `toUIMessages` converts the DB-shaped `{ id, role, parts: unknown[] }[]`
 * (`ChatMessage[]` from `lib/db/chat-messages.ts`) into `UIMessage[]` — the
 * same structural-compatibility conversion `ChatShell` already used for
 * `useChat` hydration.
 */

import { isToolUIPart, type UIMessage } from "ai";

import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { DecisionBlock, type DecisionOutput } from "./DecisionBlock";

export function toUIMessages(
  messages: { id: string; role: "user" | "assistant"; parts: unknown[] }[],
): UIMessage[] {
  return messages.map(
    (message) =>
      ({ id: message.id, role: message.role, parts: message.parts }) as unknown as UIMessage,
  );
}

export function renderPart(part: UIMessage["parts"][number], key: string) {
  if (part.type === "text") {
    return <MessageResponse key={key}>{part.text}</MessageResponse>;
  }

  if (part.type === "file" && part.mediaType?.startsWith("image/") && part.url) {
    return (
      // The re-uploaded image is served from our own image route or a data URL;
      // next/image adds no value for a one-off in-chat thumbnail.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={part.filename ?? ""}
        className="max-h-48 w-auto rounded-lg border"
        key={key}
        src={part.url}
      />
    );
  }

  if (isToolUIPart(part) && part.type === "tool-submitDecision" && part.state === "output-available") {
    return <DecisionBlock key={key} output={part.output as DecisionOutput} />;
  }

  return null;
}

export function ChatMessageView({ message }: { message: UIMessage }) {
  return (
    <Message from={message.role}>
      <MessageContent>
        {message.parts.map((part, index) => renderPart(part, `${message.id}-${index}`))}
      </MessageContent>
    </Message>
  );
}
