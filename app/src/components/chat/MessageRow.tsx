"use client";

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import type { UIMessage } from "ai";
import type { ReactNode } from "react";

import { DecisionBlock, isDecisionDataPart } from "./DecisionBlock";
import { RevisionMarker, isReviseDecisionOutputPart } from "./RevisionMarker";

/**
 * Per-message metadata carried in `UIMessage.metadata` (ADR-002 §4, ADR-003).
 *
 * `createdAt` is the only field T4.4 needs: it sources the per-bubble
 * timestamp (PRD §9.2). It comes from persisted messages on restore (AC-27)
 * and from the client clock when the customer sends a live message. Live
 * assistant messages carry no `createdAt` until persisted (T3.3 streams them);
 * MessageRow renders gracefully without it.
 *
 * Typed as a branded metadata type so consumers (the T4.5 page, restore
 * payload, tests) keep the shape in sync with what MessageRow reads.
 */
export type ChatMessageMetadata = {
  createdAt?: string;
};

const PL_TIME_FORMATTER = new Intl.DateTimeFormat("pl-PL", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return PL_TIME_FORMATTER.format(parsed);
}

/**
 * Reads `createdAt` off a UI message's metadata. The AI SDK types metadata as
 * `unknown` by default; persistence (ADR-003) stores our `ChatMessageMetadata`
 * shape verbatim, so this narrow cast is the single place that assumption
 * lives. Returns `undefined` when no timestamp is available (live assistant).
 */
function getCreatedAt(message: UIMessage): string | undefined {
  const metadata = message.metadata as ChatMessageMetadata | undefined;
  return metadata?.createdAt;
}

/**
 * Renders the supported message parts. Unknown part types (dynamic parts added
 * by future tasks) are silently skipped so the chat does not crash on message
 * shapes this UI does not understand yet (ADR-002 §3).
 *
 * Each text run is rendered as its own `MessageResponse` so non-text parts
 * can be interleaved without re-flowing the whole bubble.
 */
function renderParts(message: UIMessage): ReactNode {
  return message.parts.map((part, index) => {
    if (isDecisionDataPart(part)) {
      return (
        <DecisionBlock
          key={`part-${index}`}
          category={part.data.category}
          messageMarkdown={part.data.messageMarkdown}
        />
      );
    }

    if (isReviseDecisionOutputPart(part)) {
      return (
        <RevisionMarker
          key={`part-${index}`}
          previousDecision={part.output.previousDecision}
          newDecision={part.output.recordedDecision}
        />
      );
    }

    if (part.type !== "text") {
      return null;
    }
    return (
      <MessageResponse key={`part-${index}`}>{part.text}</MessageResponse>
    );
  });
}

export type MessageRowProps = {
  message: UIMessage;
};

/**
 * One chat bubble. Wraps the AI Elements `Message` (which handles user-right /
 * assistant-left alignment and bubble styling) and stamps a timestamp under
 * the content when one is available. PRD §9.2 alignment + timestamps.
 */
export function MessageRow({ message }: MessageRowProps) {
  const createdAt = getCreatedAt(message);
  return (
    <Message from={message.role} data-role={message.role}>
      <MessageContent>
        {renderParts(message)}
        {createdAt ? (
          <time
            dateTime={createdAt}
            className="text-muted-foreground text-xs"
          >
            {formatTimestamp(createdAt)}
          </time>
        ) : null}
      </MessageContent>
    </Message>
  );
}
