import { generateObject, NoObjectGeneratedError } from "ai";
import type { FilePart, TextPart } from "@ai-sdk/provider-utils";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { RequestFormInput, RequestType } from "@/lib/validation";
import { getVisionModel } from "./provider";
import { buildComplaintVisionPrompt, buildReturnVisionPrompt } from "./prompts";
import { imageAnalysisSchema, type ImageAnalysis } from "./types";
import { AiServiceError } from "./decision";

/**
 * Vision stage of the AI pipeline (ADR-001 section 3 "vision", section 5).
 *
 * Sends the compressed image buffer to the vision model with a request-type-
 * specific instruction and returns a Zod-validated `ImageAnalysis`. Non-
 * streaming structured output (`generateObject`), 60 s abort deadline, one
 * internal retry on transient failure, and a typed `AiServiceError` on any
 * unrecoverable failure (schema-invalid output or provider failure/timeout).
 *
 * Finding F-2: the stored upload is ALWAYS recompressed JPEG (sharp q80), so
 * the file part's media type is hardcoded to `image/jpeg` regardless of the
 * original upload MIME — never pass `form.image.type` here.
 */

// --- Constants ---------------------------------------------------------------

const VISION_DEADLINE_MS = 60_000;
/**
 * The stored file is recompressed JPEG by `lib/images` (finding F-2), so the
 * file part always carries `image/jpeg`. Passing the original upload MIME
 * would mislabel the bytes for providers that branch on media type.
 */
const STORED_IMAGE_MEDIA_TYPE = "image/jpeg";

// --- Options -----------------------------------------------------------------

export interface AnalyzeImageOptions {
  /**
   * Language model to use instead of the env-resolved vision model. Intended
   * for tests (mock provider); production callers leave this unset.
   */
  model?: LanguageModelV4;
  /**
   * Optional caller-supplied abort signal. Combined with the 60 s deadline so
   * either one cancels the call (ADR-001 section 5 timeouts).
   */
  abortSignal?: AbortSignal;
  /** Abort deadline in milliseconds. Defaults to 60_000 (ADR-001 section 5). */
  deadlineMs?: number;
}

// --- Internal: schema-invalid detection --------------------------------------

/**
 * Returns true when an error thrown by `generateObject` means the model's
 * output failed schema validation or JSON parsing. In AI SDK 7,
 * `generateObject` collapses both cases into `NoObjectGeneratedError`
 * ("response did not match schema") regardless of the underlying cause, so
 * that single class is the authoritative signal. These are NOT retried: the
 * model is unlikely to self-correct within the same deadline and retrying
 * only adds latency before the same failure (ADR-001 section 8).
 */
function isSchemaInvalidError(error: unknown): boolean {
  return error instanceof NoObjectGeneratedError;
}

// --- Internal: abort signal --------------------------------------------------

/**
 * Builds an abort signal that fires on the earlier of the caller's signal
 * and the deadline so each vision call has a hard upper bound (fail fast
 * into the retry flow instead of hanging the form, ADR-001 section 5).
 */
function buildAbortSignal(
  callerSignal: AbortSignal | undefined,
  deadlineMs: number,
): AbortSignal {
  const deadline = AbortSignal.timeout(deadlineMs);
  if (callerSignal === undefined) return deadline;
  return AbortSignal.any([callerSignal, deadline]);
}

// --- Public entry -------------------------------------------------------------

/**
 * Analyzes the compressed image buffer with the vision model and returns a
 * schema-validated `ImageAnalysis`.
 *
 * The image is sent as a single `image/jpeg` file part (finding F-2) alongside
 * the request-type-specific instruction text. Exactly one LLM call is made on
 * the happy path (TAC-001-04); a transient provider failure triggers exactly
 * one internal retry (ADR-001 section 5); schema-invalid output fails
 * immediately without retry.
 */
export async function analyzeImage(
  imageBuffer: Buffer,
  args: { requestType: RequestType; form: RequestFormInput },
  options?: AnalyzeImageOptions,
): Promise<ImageAnalysis> {
  const model = options?.model ?? getVisionModel();
  const promptText =
    args.requestType === "complaint"
      ? buildComplaintVisionPrompt(args.form)
      : buildReturnVisionPrompt(args.form);

  const deadlineMs = options?.deadlineMs ?? VISION_DEADLINE_MS;

  const callOnce = (signal: AbortSignal) =>
    generateObject({
      model,
      schema: imageAnalysisSchema,
      schemaName: "ImageAnalysis",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText } satisfies TextPart,
            {
              type: "file",
              mediaType: STORED_IMAGE_MEDIA_TYPE,
              data: imageBuffer,
            } satisfies FilePart,
          ],
        },
      ],
      // The SDK's own retry is disabled; this module owns the one-retry policy
      // so tests can assert the exact attempt count (ADR-001 section 5).
      maxRetries: 0,
      abortSignal: signal,
    });

  try {
    const { object } = await callOnce(buildAbortSignal(options?.abortSignal, deadlineMs));
    return object;
  } catch (error) {
    if (isSchemaInvalidError(error)) {
      throw new AiServiceError(
        "Vision analysis returned schema-invalid output.",
        { cause: error, stage: "vision" },
      );
    }
    // Transient (provider failure / timeout / abort): one internal retry.
    try {
      const { object } = await callOnce(
        buildAbortSignal(options?.abortSignal, deadlineMs),
      );
      return object;
    } catch (retryError) {
      throw new AiServiceError(
        "Vision analysis failed after one internal retry.",
        { cause: retryError, stage: "vision" },
      );
    }
  }
}
