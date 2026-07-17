import { and, asc, desc, eq, ne } from "drizzle-orm";
import { nanoid } from "nanoid";

import type { AppDatabase } from "./client";
import {
  type Decision,
  type DecisionCategory,
  type DecisionSource,
  decisions,
  type EquipmentCategory,
  type Message,
  type MessageRole,
  messages,
  type RequestType,
  type Session,
  sessions,
} from "./schema";

/** Thrown by `completeAnalysis` when the session is already `analyzed` (idempotence guard). */
export class AlreadyAnalyzedError extends Error {
  constructor(sessionId: string) {
    super(`Session "${sessionId}" is already analyzed`);
    this.name = "AlreadyAnalyzedError";
  }
}

/** Thrown when a repository call targets a session ID that does not exist. */
export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session "${sessionId}" not found`);
    this.name = "SessionNotFoundError";
  }
}

const MAX_ID_COLLISION_RETRIES = 5;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    (error as { code: string }).code.startsWith("SQLITE_CONSTRAINT")
  );
}

export interface ValidatedSessionForm {
  requestType: RequestType;
  category: EquipmentCategory;
  productName: string;
  purchaseDate: string;
  reason?: string | null;
}

export interface SessionImageMeta {
  imagePath: string;
  imageOriginalName: string;
  imageMediaType: string;
}

/**
 * Inserts a new session row with status `created`. Generates a nanoid ID and
 * retries on the astronomically rare event of a collision (ADR-003 §8).
 *
 * @param now - Clock override (defaults to `Date.now`); tests use this to
 *   produce deterministic, strictly-increasing timestamps for ordering checks.
 */
export function createSession(
  db: AppDatabase,
  form: ValidatedSessionForm,
  imageMeta: SessionImageMeta,
  now: () => number = Date.now,
): Session {
  const createdAt = now();
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ID_COLLISION_RETRIES; attempt++) {
    const id = nanoid();
    try {
      const [row] = db
        .insert(sessions)
        .values({
          id,
          requestType: form.requestType,
          category: form.category,
          productName: form.productName,
          purchaseDate: form.purchaseDate,
          reason: form.reason ?? null,
          imagePath: imageMeta.imagePath,
          imageOriginalName: imageMeta.imageOriginalName,
          imageMediaType: imageMeta.imageMediaType,
          status: "created",
          createdAt,
        })
        .returning()
        .all();
      return row;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `Failed to generate a unique session ID after ${MAX_ID_COLLISION_RETRIES} attempts`,
    { cause: lastError },
  );
}

export interface SessionWithHistory {
  session: Session;
  decisions: Decision[];
  messages: Message[];
}

/** Composed read model feeding both GET restore and chat-context assembly (ADR-003 §4). */
export function getSessionWithHistory(db: AppDatabase, sessionId: string): SessionWithHistory | null {
  const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!session) {
    return null;
  }

  const decisionRows = db
    .select()
    .from(decisions)
    .where(eq(decisions.sessionId, sessionId))
    .orderBy(asc(decisions.id))
    .all();

  const messageRows = db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt))
    .all();

  return { session, decisions: decisionRows, messages: messageRows };
}

export interface InitialDecisionInput {
  decision: DecisionCategory;
  justification: string;
  citedRuleIds: string[];
  guardOverride?: boolean;
}

export interface FirstAssistantMessageInput {
  /** The AI SDK UI-message ID. */
  id: string;
  parts: unknown;
}

/**
 * Persists analysis completion atomically: `visionAnalysis` + status
 * `analyzed`, the initial decision row, and the first assistant message.
 * Rejects (rolls back, throws `AlreadyAnalyzedError`) if the session is
 * already `analyzed` — see ADR-003 §7 sequence diagram.
 */
export function completeAnalysis(
  db: AppDatabase,
  sessionId: string,
  visionAnalysis: unknown,
  initialDecision: InitialDecisionInput,
  firstMessage: FirstAssistantMessageInput,
  now: () => number = Date.now,
): void {
  db.transaction((tx) => {
    const existing = tx
      .select({ status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get();

    if (!existing) {
      throw new SessionNotFoundError(sessionId);
    }

    const timestamp = now();

    const updateResult = tx
      .update(sessions)
      .set({ visionAnalysis: JSON.stringify(visionAnalysis), status: "analyzed" })
      .where(and(eq(sessions.id, sessionId), ne(sessions.status, "analyzed")))
      .run();

    if (updateResult.changes === 0) {
      throw new AlreadyAnalyzedError(sessionId);
    }

    tx.insert(decisions)
      .values({
        sessionId,
        decision: initialDecision.decision,
        previousDecision: null,
        justification: initialDecision.justification,
        citedRuleIds: JSON.stringify(initialDecision.citedRuleIds),
        source: "initial",
        guardOverride: initialDecision.guardOverride ?? false,
        createdAt: timestamp,
      })
      .run();

    tx.insert(messages)
      .values({
        id: firstMessage.id,
        sessionId,
        role: "assistant",
        parts: JSON.stringify(firstMessage.parts),
        createdAt: timestamp,
      })
      .run();
  });
}

/** Flips status to `analysis_failed`. Form data and image are left untouched (AC-28). */
export function markAnalysisFailed(db: AppDatabase, sessionId: string): void {
  db.update(sessions).set({ status: "analysis_failed" }).where(eq(sessions.id, sessionId)).run();
}

export interface AppendDecisionInput {
  decision: DecisionCategory;
  justification: string;
  citedRuleIds: string[];
  source: DecisionSource;
  guardOverride?: boolean;
}

/**
 * Appends a decision row, chaining `previousDecision` from the latest
 * existing decision for this session. Used by the `revise_decision` tool
 * execute (ADR-003 §5).
 */
export function appendDecision(
  db: AppDatabase,
  sessionId: string,
  input: AppendDecisionInput,
  now: () => number = Date.now,
): Decision {
  return db.transaction((tx) => {
    const previous = tx
      .select({ decision: decisions.decision })
      .from(decisions)
      .where(eq(decisions.sessionId, sessionId))
      .orderBy(desc(decisions.id))
      .limit(1)
      .get();

    const [row] = tx
      .insert(decisions)
      .values({
        sessionId,
        decision: input.decision,
        previousDecision: previous?.decision ?? null,
        justification: input.justification,
        citedRuleIds: JSON.stringify(input.citedRuleIds),
        source: input.source,
        guardOverride: input.guardOverride ?? false,
        createdAt: now(),
      })
      .returning()
      .all();

    return row;
  });
}

export interface UiMessageInput {
  /** The AI SDK UI-message ID. */
  id: string;
  role: MessageRole;
  parts: unknown;
}

/**
 * Appends a message, upserting by ID so a retried persist of the same
 * UI message cannot duplicate rows (ADR-003 §5). `createdAt` is preserved
 * from the first insert on conflict so history ordering stays stable.
 */
export function appendMessage(
  db: AppDatabase,
  sessionId: string,
  uiMessage: UiMessageInput,
  now: () => number = Date.now,
): void {
  db.insert(messages)
    .values({
      id: uiMessage.id,
      sessionId,
      role: uiMessage.role,
      parts: JSON.stringify(uiMessage.parts),
      createdAt: now(),
    })
    .onConflictDoUpdate({
      target: messages.id,
      set: {
        role: uiMessage.role,
        parts: JSON.stringify(uiMessage.parts),
      },
    })
    .run();
}
