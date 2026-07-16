/**
 * `POST /api/cases` — create a case from the request form + image and run the
 * two-stage AI pipeline to produce the first decision (ADR-000 §6, §9.3;
 * PRD AC-06/07, AC-10..14, AC-20, AC-32/33/35).
 *
 * Persistence order per the "Form submission and AI analysis" sequence:
 *   validate → compress → insert Case + CaseImage → analyzeImage →
 *   insert ImageAnalysis → (if conclusive) loadPolicy + decideInitial →
 *   insert Decision → persist first assistant chat message → respond.
 *
 * The case row and image are persisted BEFORE the LLM calls run, so a failure
 * returns `502 { retryable: true, caseId }` and the client can retry the AI
 * pipeline alone by re-POSTing with a `caseId` field (see "Retry mechanism"
 * below) — no second upload, no duplicate case.
 *
 * ## Retry mechanism
 * A multipart body carrying a non-empty `caseId` field (and no new image) is a
 * retry: the route reloads the case, reads the already-stored (compressed)
 * image from disk, and re-runs ONLY the AI pipeline against it. It inserts a
 * fresh ImageAnalysis (+ Decision) but no new Case/CaseImage rows. Because the
 * `502` response includes `caseId`, the client always has the handle it needs
 * to retry.
 *
 * ## Testability
 * `createCasesPostHandler(deps)` is the dependency-injected seam: integration
 * tests pass a temp SQLite handle, a temp uploads dir, a temp policies dir, and
 * mock `LanguageModelV4` models (no network). The exported `POST` wires the
 * production defaults (`getDb()`, `createModels()`).
 */

import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { pl } from "@/lib/copy/pl";
import {
  caseFormSchema,
  type AllowedImageMimeType,
  type CaseFormValues,
  type EquipmentCategory,
  type RequestType,
} from "@/lib/validation/case-form.schema";
import { compressImage } from "@/lib/images/compress";
import { writeCaseImage, readCaseImage } from "@/lib/images/storage";
import { loadPolicy } from "@/lib/policies/loader";
import { analyzeImage } from "@/lib/ai/image-analysis";
import { decideInitial } from "@/lib/ai/decision-agent";
import { AiProviderError } from "@/lib/ai/errors";
import { createModels, type Models } from "@/lib/ai/providers";
import { getDb } from "@/lib/db/client";
import { createCase, getCaseWithHistory } from "@/lib/db/cases";
import { insertCaseImage } from "@/lib/db/case-images";
import { insertImageAnalysis } from "@/lib/db/image-analyses";
import { insertDecision, type DecisionStatus } from "@/lib/db/decisions";
import { appendChatMessage } from "@/lib/db/chat-messages";

export interface CasesPostDeps {
  db: Database.Database;
  models: Models;
  /** Uploads root; defaults to `lib/images/storage`'s `app/uploads/`. */
  uploadsBaseDir?: string;
  /** Policy docs dir; defaults to `lib/policies`'s repo-root `docs/policies/`. */
  policiesDir?: string;
}

/** Shared context threaded through the AI pipeline (create + retry). */
interface PipelineContext {
  caseId: string;
  caseNumber: string;
  requestType: RequestType;
  formData: CaseFormValues;
  imageBuffer: Buffer;
  caseImageId: string;
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

function service502(caseId?: string, caseNumber?: string): Response {
  return json(
    {
      retryable: true,
      error: pl.form.serviceError.message,
      ...(caseId ? { caseId, caseNumber } : {}),
    },
    502,
  );
}

/** Maps a Zod error to a `{ field: polishMessage }` map (first message wins). */
function buildFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    const field = typeof key === "string" ? key : "form";
    if (!(field in fieldErrors)) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Assembles the first assistant chat message's parts (AC-20): a `text` part
 * with the greeting + case number, followed by a `tool-submitDecision`
 * output part shaped exactly like the streaming chat route's real tool call.
 * This lets `MessageParts.tsx` render the decision as the same
 * visually-distinguished `DecisionBlock` card regardless of whether it
 * arrived synchronously (this, the first message) or via a later streamed
 * tool call — `DecisionBlock` already renders the justification, next
 * steps, the escalation notice (AC-40, for `needs_human_review`), and the
 * mandatory disclaimer itself, so none of those are duplicated here.
 */
function assembleDecisionMessageParts(
  caseNumber: string,
  status: DecisionStatus,
  justification: string,
  nextSteps: string[],
): unknown[] {
  const greeting = `${pl.chat.greeting.salutation} ${pl.chat.greeting.intro}`;
  return [
    {
      type: "text",
      text: `${greeting}\n\n${pl.chat.caseSummary.caseNumberLabel}: ${caseNumber}`,
    },
    {
      type: "tool-submitDecision",
      toolCallId: randomUUID(),
      state: "output-available",
      input: {},
      output: {
        status,
        justification,
        nextSteps,
        isRevision: false,
      },
    },
  ];
}

/** Assembles the "please upload a better photo" first message (AC-14). */
function assembleReuploadMessage(customerFacingIssue: string | null): string {
  const blocks = [`${pl.chat.greeting.salutation} ${pl.chat.greeting.intro}`];
  if (customerFacingIssue) {
    blocks.push(customerFacingIssue);
  }
  blocks.push(pl.chat.reupload.prompt);
  return blocks.join("\n\n");
}

/**
 * Persists a first assistant message. AC-35: this is a NON-critical write —
 * a failure here must not block the customer's decision, so it is caught and
 * logged rather than propagated.
 */
function persistAssistantMessage(db: Database.Database, caseId: string, parts: unknown[]): void {
  try {
    appendChatMessage(db, caseId, "assistant", parts);
  } catch (error) {
    console.error(`Failed to persist first assistant message for case ${caseId}:`, error);
  }
}

/**
 * Stage 1 + Stage 2 of the pipeline, shared by the create and retry paths.
 * The Case and CaseImage already exist; this inserts the ImageAnalysis and
 * (when the analysis is conclusive) the Decision, then responds.
 */
async function runAiPipeline(deps: CasesPostDeps, ctx: PipelineContext): Promise<Response> {
  let analysis;
  try {
    analysis = await analyzeImage(
      ctx.requestType,
      ctx.formData,
      ctx.imageBuffer,
      deps.models.visionModel,
    );
  } catch (error) {
    if (error instanceof AiProviderError) {
      return service502(ctx.caseId, ctx.caseNumber);
    }
    throw error;
  }

  insertImageAnalysis(deps.db, ctx.caseId, ctx.caseImageId, {
    conclusive: analysis.conclusive,
    analysis,
  });

  // AC-14: inconclusive first analysis -> ask for a better photo, no decision.
  if (!analysis.conclusive) {
    persistAssistantMessage(deps.db, ctx.caseId, [
      { type: "text", text: assembleReuploadMessage(analysis.customerFacingIssue) },
    ]);
    return json(
      {
        caseId: ctx.caseId,
        caseNumber: ctx.caseNumber,
        decision: null,
        requiresBetterPhoto: true,
      },
      200,
    );
  }

  const policyMarkdown = loadPolicy(ctx.requestType, deps.policiesDir);

  let decision;
  try {
    decision = await decideInitial(
      ctx.requestType,
      ctx.formData,
      analysis,
      policyMarkdown,
      deps.models.textModel,
    );
  } catch (error) {
    if (error instanceof AiProviderError) {
      return service502(ctx.caseId, ctx.caseNumber);
    }
    throw error;
  }

  // insertDecision sets cases.needs_review when status is needs_human_review.
  insertDecision(deps.db, ctx.caseId, {
    status: decision.status,
    justification: decision.justification,
    nextSteps: decision.nextSteps,
  });

  persistAssistantMessage(
    deps.db,
    ctx.caseId,
    assembleDecisionMessageParts(
      ctx.caseNumber,
      decision.status,
      decision.justification,
      decision.nextSteps,
    ),
  );

  return json(
    {
      caseId: ctx.caseId,
      caseNumber: ctx.caseNumber,
      decision: {
        status: decision.status,
        justification: decision.justification,
        nextSteps: decision.nextSteps,
        disclaimer: pl.chat.disclaimer,
      },
      requiresBetterPhoto: false,
    },
    200,
  );
}

/** Create path: validate the form + image, persist Case + CaseImage, run AI. */
async function handleCreate(deps: CasesPostDeps, formData: FormData): Promise<Response> {
  const rawImage = formData.get("image");
  const imageFile = rawImage instanceof File ? rawImage : null;

  const rawDescription = formData.get("description");
  const candidate = {
    requestType: formData.get("requestType") ?? undefined,
    category: formData.get("category") ?? undefined,
    productName: formData.get("productName") ?? undefined,
    purchaseDate: formData.get("purchaseDate") ?? undefined,
    description: typeof rawDescription === "string" ? rawDescription : undefined,
    // Validate the image as metadata only (AC-05) before reading any bytes,
    // so oversized/wrong-type uploads are rejected without touching memory/AI.
    image: imageFile ? { mimeType: imageFile.type, sizeBytes: imageFile.size } : undefined,
  };

  const parsed = caseFormSchema.safeParse(candidate);
  if (!parsed.success) {
    return json({ fieldErrors: buildFieldErrors(parsed.error) }, 400);
  }
  const values = parsed.data;

  // Guaranteed non-null once the schema validated the image metadata; this
  // guard only narrows the type for the compiler.
  if (!imageFile) {
    return json({ fieldErrors: { image: pl.form.errors.imageRequired } }, 400);
  }

  // AC-10: compress before persisting and before any LLM call.
  const rawBuffer = Buffer.from(await imageFile.arrayBuffer());
  const compressed = await compressImage(rawBuffer);

  const created = createCase(deps.db, {
    requestType: values.requestType,
    category: values.category,
    productName: values.productName,
    purchaseDate: values.purchaseDate,
    description: values.description ?? null,
  });

  const stored = writeCaseImage(created.id, compressed, deps.uploadsBaseDir);
  const caseImage = insertCaseImage(deps.db, created.id, {
    filePath: stored.relativePath,
    source: "form",
    originalFilename: imageFile.name || "upload",
    // The stored file is always re-encoded to JPEG by compressImage.
    mimeType: "image/jpeg",
  });

  return runAiPipeline(deps, {
    caseId: created.id,
    caseNumber: created.caseNumber,
    requestType: values.requestType,
    formData: values,
    imageBuffer: compressed,
    caseImageId: caseImage.id,
  });
}

/** Retry path: reload the case + stored image and re-run the AI pipeline only. */
async function handleRetry(deps: CasesPostDeps, caseId: string): Promise<Response> {
  const detail = getCaseWithHistory(deps.db, caseId);
  if (!detail) {
    return json({ error: pl.errors.caseNotFound }, 404);
  }

  const lastImage = detail.images.at(-1);
  if (!lastImage) {
    // A case with no stored image cannot be retried without a re-upload.
    return json({ error: pl.errors.genericApi }, 400);
  }

  let imageBuffer: Buffer;
  try {
    imageBuffer = readCaseImage(lastImage.filePath, deps.uploadsBaseDir);
  } catch (error) {
    console.error(`Failed to read stored image for case ${caseId}:`, error);
    return json({ error: pl.errors.genericApi }, 400);
  }

  const formData: CaseFormValues = {
    requestType: detail.requestType,
    // The category was validated against the enum when the case was created.
    category: detail.category as EquipmentCategory,
    productName: detail.productName,
    purchaseDate: detail.purchaseDate,
    description: detail.description ?? undefined,
    // Stored images are always re-encoded to JPEG, an allowed type.
    image: {
      mimeType: lastImage.mimeType as AllowedImageMimeType,
      sizeBytes: imageBuffer.length,
    },
  };

  return runAiPipeline(deps, {
    caseId: detail.id,
    caseNumber: detail.caseNumber,
    requestType: detail.requestType,
    formData,
    imageBuffer,
    caseImageId: lastImage.id,
  });
}

/** DI factory: builds the `POST` handler from injectable dependencies. */
export function createCasesPostHandler(deps: CasesPostDeps) {
  return async function POST(request: Request): Promise<Response> {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return json({ error: pl.errors.genericApi }, 400);
    }

    const rawCaseId = formData.get("caseId");
    const retryCaseId = typeof rawCaseId === "string" && rawCaseId.trim() ? rawCaseId.trim() : null;

    return retryCaseId ? handleRetry(deps, retryCaseId) : handleCreate(deps, formData);
  };
}

/** Production handler: wires the shared DB connection and OpenRouter models. */
export async function POST(request: Request): Promise<Response> {
  return createCasesPostHandler({
    db: getDb(),
    models: createModels(),
  })(request);
}
