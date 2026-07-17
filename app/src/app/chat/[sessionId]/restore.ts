import type { UIMessage } from "ai";

import type { ChatMessageMetadata } from "@/components/chat/MessageRow";
import type {
  DecisionCategory,
  DecisionDataPart,
} from "@/components/chat/DecisionBlock";
import type { Decision, Message, Session } from "@/lib/db/schema";

export interface SessionHistory {
  session: Session;
  decisions: Decision[];
  messages: Message[];
}

type RestoredChatMessage = UIMessage<ChatMessageMetadata>;
type RestoredChatRole = "user" | "assistant";
type RestoredParts = RestoredChatMessage["parts"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTextPart(part: unknown): part is { type: "text"; text: string } {
  return isRecord(part) && part.type === "text" && typeof part.text === "string";
}

function parseParts(raw: string): RestoredParts {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RestoredParts) : [];
  } catch {
    return [];
  }
}

function extractTextMarkdown(raw: string): string | null {
  const parts = parseParts(raw);
  const text = parts.filter(isTextPart).map((part) => part.text);
  return text.length > 0 ? text.join("\n\n") : null;
}

function metadataFor(message: Message): ChatMessageMetadata {
  return { createdAt: new Date(message.createdAt).toISOString() };
}

export function buildChatMessages(
  history: SessionHistory,
): RestoredChatMessage[] {
  const initialDecision = history.decisions.find(
    (decision) => decision.source === "initial",
  );
  const initialMessageId = history.messages.find(
    (message) => message.role === "assistant",
  )?.id;

  return history.messages.map((message) => {
    const metadata = metadataFor(message);

    if (
      initialDecision !== undefined &&
      initialMessageId !== undefined &&
      message.id === initialMessageId
    ) {
      const decisionPart: DecisionDataPart = {
        type: "data-decision",
        data: {
          category: initialDecision.decision as DecisionCategory,
          messageMarkdown:
            extractTextMarkdown(message.parts) ?? initialDecision.justification,
        },
      };

      return {
        id: message.id,
        role: "assistant",
        metadata,
        parts: [decisionPart],
      };
    }

    return {
      id: message.id,
      role: message.role as RestoredChatRole,
      metadata,
      parts: parseParts(message.parts),
    };
  });
}
