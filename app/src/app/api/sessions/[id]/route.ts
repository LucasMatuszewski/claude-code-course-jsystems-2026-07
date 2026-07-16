import { getDb } from "@/lib/db/client";
import { getSessionWithHistory } from "@/lib/db/repositories";
import type {
  Decision,
  DecisionCategory,
  DecisionSource,
  EquipmentCategory,
  Message,
  MessageRole,
  RequestType,
  Session,
  SessionStatus,
} from "@/lib/db/schema";

/**
 * GET /api/sessions/:id (ADR-000 section 6, AC-27).
 *
 * Restores a session for the chat screen: form-data summary, all decisions
 * (ordered by id), and all messages in the AI SDK UI-message format ready
 * for chat initialization. Returns 404 for an unknown id.
 *
 * In Next.js 16 the dynamic `params` argument is a Promise and must be
 * awaited (verified against the bundled route-handler docs).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const history = getSessionWithHistory(getDb(), id);
  if (history === null) {
    return Response.json(
      { error: "Nie znaleziono sesji o podanym identyfikatorze." },
      { status: 404 },
    );
  }

  return Response.json(toRestorePayload(history), { status: 200 });
}

// --- Restore payload shape ------------------------------------------------

/**
 * The full restore payload returned by GET /api/sessions/:id.
 *
 * Consumed by the chat screen (AC-27) and indirectly by downstream tasks.
 * `messages` are in UI-message format (`{ id, role, parts }` with `parts`
 * parsed back to the original UI-message parts structure) so they can be
 * fed directly into `useChat` initialization.
 */
export interface SessionRestorePayload {
  id: string;
  requestType: RequestType;
  category: EquipmentCategory;
  productName: string;
  purchaseDate: string;
  reason: string | null;
  imagePath: string;
  imageOriginalName: string;
  imageMediaType: string;
  status: SessionStatus;
  createdAt: number;
  decisions: DecisionRestore[];
  messages: MessageRestore[];
}

export interface DecisionRestore {
  id: number;
  decision: DecisionCategory;
  previousDecision: DecisionCategory | null;
  justification: string;
  citedRuleIds: string[];
  source: DecisionSource;
  guardOverride: boolean;
  createdAt: number;
}

export interface MessageRestore {
  id: string;
  role: MessageRole;
  /** UI-message parts, parsed from the stored JSON back to an object. */
  parts: unknown;
  createdAt: number;
}

function toRestorePayload(history: {
  session: Session;
  decisions: Decision[];
  messages: Message[];
}): SessionRestorePayload {
  const { session, decisions, messages } = history;

  return {
    id: session.id,
    requestType: session.requestType as RequestType,
    category: session.category as EquipmentCategory,
    productName: session.productName,
    purchaseDate: session.purchaseDate,
    reason: session.reason,
    imagePath: session.imagePath,
    imageOriginalName: session.imageOriginalName,
    imageMediaType: session.imageMediaType,
    status: session.status as SessionStatus,
    createdAt: session.createdAt,
    decisions: decisions.map(toDecisionRestore),
    messages: messages.map(toMessageRestore),
  };
}

function toDecisionRestore(decision: Decision): DecisionRestore {
  return {
    id: decision.id,
    decision: decision.decision as DecisionCategory,
    previousDecision:
      (decision.previousDecision as DecisionCategory | null) ?? null,
    justification: decision.justification,
    citedRuleIds: parseJsonArray(decision.citedRuleIds),
    source: decision.source as DecisionSource,
    guardOverride: decision.guardOverride,
    createdAt: decision.createdAt,
  };
}

function toMessageRestore(message: Message): MessageRestore {
  return {
    id: message.id,
    role: message.role as MessageRole,
    parts: parseJsonOrNull(message.parts),
    createdAt: message.createdAt,
  };
}

/**
 * Parses a stored JSON column back to a string array. The repository always
 * writes `JSON.stringify(string[])`, so a parse failure indicates data
 * corruption — fall back to an empty array rather than crashing the restore.
 */
function parseJsonArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/** Parses stored UI-message parts JSON; falls back to null on corruption. */
function parseJsonOrNull(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
