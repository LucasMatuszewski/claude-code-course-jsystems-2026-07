import { nanoid } from "nanoid";

import { AiServiceError, makeDecision } from "@/lib/ai/decision";
import { analyzeImage } from "@/lib/ai/vision";
import { getDb } from "@/lib/db/client";
import {
  AlreadyAnalyzedError,
  completeAnalysis,
  getSessionWithHistory,
  markAnalysisFailed,
  type SessionWithHistory,
} from "@/lib/db/repositories";
import type {
  Decision,
  DecisionCategory,
  DecisionSource,
  EquipmentCategory,
  RequestType as DbRequestType,
  Session,
} from "@/lib/db/schema";
import { readImage } from "@/lib/images";
import { pl } from "@/lib/i18n";
import type {
  RequestFormInput,
  RequestType as ValidationRequestType,
} from "@/lib/validation";

const SESSION_NOT_FOUND_ERROR = "Nie znaleziono sesji o podanym identyfikatorze.";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const db = getDb();

  const history = getSessionWithHistory(db, id);
  if (history === null) {
    return notFoundResponse();
  }

  if (history.session.status === "analyzed") {
    return Response.json(toAnalyzePayload(history), { status: 200 });
  }

  try {
    const { session } = history;
    const imageBuffer = await readImage(session.imagePath);
    const requestType = session.requestType as ValidationRequestType;
    const form = toRequestFormInput(session, imageBuffer.byteLength);

    const analysis = await analyzeImage(imageBuffer, { requestType, form });
    const decisionResult = await makeDecision({ requestType, form, analysis });

    completeAnalysis(
      db,
      id,
      analysis,
      {
        decision: decisionResult.decision,
        justification: decisionResult.justification,
        citedRuleIds: decisionResult.citedRuleIds,
        // Known limitation: makeDecision does not expose raw pre-guard output,
        // so the initial decision cannot detect guard overrides here yet.
      },
      {
        id: nanoid(),
        parts: [{ type: "text", text: decisionResult.messageMarkdown }],
      },
    );
  } catch (error) {
    if (error instanceof AlreadyAnalyzedError) {
      const existing = getSessionWithHistory(db, id);
      if (existing === null) {
        return notFoundResponse();
      }
      return Response.json(toAnalyzePayload(existing), { status: 200 });
    }

    if (error instanceof AiServiceError) {
      markAnalysisFailed(db, id);
      return Response.json(
        { error: pl.errorBanner.retry.message },
        { status: 502 },
      );
    }

    throw error;
  }

  const persisted = getSessionWithHistory(db, id);
  if (persisted === null) {
    return notFoundResponse();
  }

  return Response.json(toAnalyzePayload(persisted), { status: 200 });
}

// --- Analyze payload shape --------------------------------------------------

export interface AnalyzeDecisionPayload {
  id: number;
  decision: DecisionCategory;
  previousDecision: DecisionCategory | null;
  justification: string;
  citedRuleIds: string[];
  source: DecisionSource;
  guardOverride: boolean;
  createdAt: number;
}

export interface AnalyzeResponsePayload {
  sessionId: string;
  decision: AnalyzeDecisionPayload;
}

function toAnalyzePayload(history: SessionWithHistory): AnalyzeResponsePayload {
  const initialDecision = history.decisions.find(
    (decision) => decision.source === "initial",
  );

  if (!initialDecision) {
    throw new Error(`Analyzed session "${history.session.id}" has no initial decision`);
  }

  return {
    sessionId: history.session.id,
    decision: toAnalyzeDecisionPayload(initialDecision),
  };
}

function toAnalyzeDecisionPayload(decision: Decision): AnalyzeDecisionPayload {
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

function toRequestFormInput(session: Session, imageSize: number): RequestFormInput {
  return {
    requestType: session.requestType as DbRequestType,
    category: session.category as EquipmentCategory,
    productName: session.productName,
    purchaseDate: session.purchaseDate,
    reason: session.reason ?? undefined,
    image: { type: session.imageMediaType, size: imageSize },
  };
}

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

function notFoundResponse(): Response {
  return Response.json(
    { error: SESSION_NOT_FOUND_ERROR },
    { status: 404 },
  );
}
