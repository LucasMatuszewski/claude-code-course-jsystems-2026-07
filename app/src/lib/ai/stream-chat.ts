/**
 * Stage 3 of the AI pipeline (ADR-002 §3/§5): the ongoing, streaming chat
 * turn behind `POST /api/cases/[caseId]/chat`.
 *
 * The turn is **stateless per request** (ADR-000 §6): it rebuilds the full
 * decision context from SQLite on every call — the applicable policy
 * document, the form data, the latest image analysis, and the prior
 * transcript — then streams a UI-message response via `streamText` +
 * `toUIMessageStream`. The decision agent has one tool, `submitDecision`
 * (schema = `DecisionSchema`), which it calls whenever it issues an initial
 * or revised decision; the tool's `execute` persists exactly one `decisions`
 * row (the DB layer derives `isRevision` and flips `cases.needs_review`).
 *
 * Two extra behaviours layer on top of the plain conversation:
 *  - Re-upload (flow 4.3): if the incoming user message carries an image
 *    file part, the turn compresses + stores it and re-runs Stage-1 analysis
 *    synchronously *before* streaming, folding the fresh analysis into the
 *    system prompt (new `case_images` + `image_analyses` rows).
 *  - Mandatory escalation (AC-14): when that re-analysis is the *second*
 *    inconclusive analysis for the case, the decision is forced to
 *    `needs_human_review` regardless of what the model proposes.
 *
 * Persistence (AC-33): the incoming user message and the full assistant
 * response (all parts, including the tool part) are written as
 * `chat_messages` rows in the stream's `onFinish`/`onEnd` callback.
 */

import type Database from "better-sqlite3";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";

import { pl } from "@/lib/copy/pl";
import { AiProviderError } from "@/lib/ai/errors";
import { analyzeImage } from "@/lib/ai/image-analysis";
import { decisionSystemPrompt } from "@/lib/ai/prompts";
import { DecisionSchema, type Decision, type ImageAnalysis } from "@/lib/ai/schemas";
import { type Models } from "@/lib/ai/providers";
import { compressImage } from "@/lib/images/compress";
import { writeCaseImage } from "@/lib/images/storage";
import { loadPolicy } from "@/lib/policies/loader";
import { appendChatMessage } from "@/lib/db/chat-messages";
import { getCaseWithHistory, type CaseDetail } from "@/lib/db/cases";
import { insertCaseImage } from "@/lib/db/case-images";
import { insertImageAnalysis } from "@/lib/db/image-analyses";
import { insertDecision, type DecisionStatus } from "@/lib/db/decisions";
import type {
  AllowedImageMimeType,
  CaseFormValues,
  EquipmentCategory,
} from "@/lib/validation/case-form.schema";

export interface StreamChatDeps {
  db: Database.Database;
  models: Models;
  /** Uploads root; defaults to `lib/images/storage`'s `app/uploads/`. */
  uploadsBaseDir?: string;
  /** Policy docs dir; defaults to `lib/policies`'s repo-root `docs/policies/`. */
  policiesDir?: string;
}

/** Fallback analysis so the system prompt is always well-formed even if a case somehow has none. */
const FALLBACK_ANALYSIS: ImageAnalysis = {
  conclusive: false,
  damaged: false,
  damageType: null,
  plausibleCause: null,
  usageSigns: null,
  confidence: "low",
  customerFacingIssue: null,
  internalNotes: "Brak dostępnej analizy zdjęcia.",
};

const ESCALATION_DIRECTIVE = `

## Wymagana eskalacja

To już druga niejednoznaczna analiza zdjęcia dla tej sprawy. Zgodnie z zasadami
NIE proś o kolejne zdjęcie — musisz teraz wydać decyzję "Do weryfikacji przez
pracownika" (needs_human_review) poprzez wywołanie narzędzia submitDecision.`;

function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

/** Rebuilds the shared, validated form-value shape from a persisted case. */
function rebuildFormData(detail: CaseDetail, imageSizeBytes: number): CaseFormValues {
  return {
    requestType: detail.requestType,
    // The category was validated against the enum when the case was created.
    category: detail.category as EquipmentCategory,
    productName: detail.productName,
    purchaseDate: detail.purchaseDate,
    description: detail.description ?? undefined,
    // Stored/re-uploaded images are always re-encoded to JPEG, an allowed type.
    image: { mimeType: "image/jpeg" as AllowedImageMimeType, sizeBytes: imageSizeBytes },
  };
}

/** Decodes a base64 (or percent-encoded) `data:` URL into raw bytes. */
function decodeDataUrl(url: string): Buffer {
  const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(url);
  if (!match) {
    throw new Error("Unsupported file part URL (expected a data URL).");
  }
  const isBase64 = Boolean(match[2]);
  const payload = match[3];
  return isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
}

/** The last user message in the transcript (the new turn), if any. */
function lastUserMessage(messages: UIMessage[]): UIMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") {
      return messages[i];
    }
  }
  return undefined;
}

/** The first image `file` part of a message, if present (chat re-upload). */
function imageFilePart(message: UIMessage | undefined) {
  const parts = message?.parts ?? [];
  for (const part of parts) {
    if (part.type === "file" && part.mediaType.startsWith("image/")) {
      return part;
    }
  }
  return undefined;
}

/**
 * Replaces file parts with a short text note before sending to the text
 * model: the re-uploaded image is already analyzed and folded into the
 * system prompt, so the (text-only) decision model never needs the bytes.
 */
function toModelMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) =>
      part.type === "file"
        ? ({ type: "text", text: "[Klient przesłał zdjęcie do analizy.]" } as const)
        : part,
    ),
  }));
}

/**
 * Rewrites a re-uploaded file part's data URL to the served image path so the
 * persisted transcript stays small (bytes already live on disk + in
 * `case_images`) and the reviewer/chat views can render it via the image
 * route.
 */
function persistableUserParts(message: UIMessage, servedImageUrl: string | null): unknown[] {
  if (!servedImageUrl) {
    return message.parts;
  }
  return message.parts.map((part) =>
    part.type === "file" ? { ...part, url: servedImageUrl } : part,
  );
}

/** Builds the `submitDecision` tool; `forcedStatus` overrides the model's status (AC-14 escalation). */
function createSubmitDecisionTool(
  db: Database.Database,
  caseId: string,
  forcedStatus?: DecisionStatus,
) {
  return tool({
    description:
      "Zapisuje decyzję w sprawie (początkową lub jej rewizję). Wywołaj to narzędzie zawsze, " +
      "gdy wydajesz lub zmieniasz decyzję. Zwykłe odpowiedzi i pytania doprecyzowujące nie wymagają wywołania.",
    inputSchema: DecisionSchema,
    execute: async (input: Decision) => {
      const status: DecisionStatus = forcedStatus ?? input.status;
      // The DB layer derives `isRevision` (first decision => false) and flips
      // `cases.needs_review` when the status is `needs_human_review`.
      const decision = insertDecision(db, caseId, {
        status,
        justification: input.justification,
        nextSteps: input.nextSteps,
      });
      return {
        status: decision.status,
        justification: decision.justification,
        nextSteps: decision.nextSteps,
        isRevision: decision.isRevision,
      };
    },
  });
}

/** Returns a streamed error-part response (client handles retry per AC-25). */
function errorStreamResponse(): Response {
  const stream = createUIMessageStream({
    execute: () => {
      throw new Error("Chat provider failure.");
    },
    onError: () => pl.chat.streamError.message,
  });
  return createUIMessageStreamResponse({ stream });
}

/**
 * Runs one streaming chat turn for `caseId`. Returns a `404` JSON response
 * for an unknown case, a streamed error response if the pre-stream re-upload
 * analysis fails, and otherwise a streamed UI-message response.
 */
export async function streamChatTurn(
  deps: StreamChatDeps,
  caseId: string,
  messages: UIMessage[],
): Promise<Response> {
  const detail = getCaseWithHistory(deps.db, caseId);
  if (!detail) {
    return json({ error: pl.errors.caseNotFound }, 404);
  }

  const requestType = detail.requestType;
  const newUserMessage = lastUserMessage(messages);
  const filePart = imageFilePart(newUserMessage);

  // Latest analysis for context: the most recent stored one, unless a re-upload replaces it.
  let latestAnalysis: ImageAnalysis =
    detail.analyses.length > 0
      ? (detail.analyses[detail.analyses.length - 1].analysis as ImageAnalysis)
      : FALLBACK_ANALYSIS;
  let formImageSize = 0;
  let servedImageUrl: string | null = null;
  let mandatoryEscalation = false;

  if (filePart) {
    // Re-upload flow (4.3): compress + store + re-analyze BEFORE streaming.
    let compressed: Buffer;
    try {
      compressed = await compressImage(decodeDataUrl(filePart.url));
    } catch {
      return errorStreamResponse();
    }

    const stored = writeCaseImage(caseId, compressed, deps.uploadsBaseDir);
    const caseImage = insertCaseImage(deps.db, caseId, {
      filePath: stored.relativePath,
      source: "chat_reupload",
      originalFilename: filePart.filename ?? "reupload.jpg",
      mimeType: "image/jpeg",
    });
    servedImageUrl = `/api/images/${stored.relativePath}`;
    formImageSize = compressed.length;

    let freshAnalysis: ImageAnalysis;
    try {
      freshAnalysis = await analyzeImage(
        requestType,
        rebuildFormData(detail, formImageSize),
        compressed,
        deps.models.visionModel,
      );
    } catch (error) {
      if (error instanceof AiProviderError) {
        return errorStreamResponse();
      }
      throw error;
    }

    insertImageAnalysis(deps.db, caseId, caseImage.id, {
      conclusive: freshAnalysis.conclusive,
      analysis: freshAnalysis,
    });
    latestAnalysis = freshAnalysis;

    // AC-14: a second inconclusive analysis forces escalation.
    if (!freshAnalysis.conclusive) {
      const priorInconclusive = detail.analyses.filter((a) => !a.conclusive).length;
      if (priorInconclusive + 1 >= 2) {
        mandatoryEscalation = true;
      }
    }
  }

  const policyMarkdown = loadPolicy(requestType, deps.policiesDir);
  const formData = rebuildFormData(detail, formImageSize);
  const systemPrompt =
    decisionSystemPrompt(requestType, formData, latestAnalysis, policyMarkdown) +
    (mandatoryEscalation ? ESCALATION_DIRECTIVE : "");

  const result = streamText({
    model: deps.models.textModel,
    system: systemPrompt,
    messages: await convertToModelMessages(toModelMessages(messages)),
    tools: {
      submitDecision: createSubmitDecisionTool(
        deps.db,
        caseId,
        mandatoryEscalation ? "needs_human_review" : undefined,
      ),
    },
    // A single model step keeps the turn deterministic: exactly one decision
    // row per `submitDecision` call, no runaway multi-step loops.
    stopWhen: isStepCount(1),
    // Force the tool call only when escalation is mandatory (AC-14).
    ...(mandatoryEscalation ? { toolChoice: "required" as const } : {}),
  });

  const stream = toUIMessageStream({
    stream: result.stream,
    originalMessages: messages,
    onError: () => pl.chat.streamError.message,
    // AC-33: persist the user turn + the full assistant response (all parts).
    onFinish: ({ responseMessage }) => {
      try {
        if (newUserMessage) {
          appendChatMessage(
            deps.db,
            caseId,
            "user",
            persistableUserParts(newUserMessage, servedImageUrl),
          );
        }
        appendChatMessage(deps.db, caseId, "assistant", responseMessage.parts);
      } catch (error) {
        // AC-35: a persistence failure must not break the already-streamed turn.
        console.error(`Failed to persist chat messages for case ${caseId}:`, error);
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
