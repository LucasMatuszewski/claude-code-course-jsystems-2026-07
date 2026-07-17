import { generateObject, NoObjectGeneratedError } from "ai";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { todayIsoDate, type RequestFormInput, type RequestType } from "@/lib/validation";
import { loadPolicy } from "@/lib/policies";
import { getTextModel } from "./provider";
import {
  buildComplaintDecisionPrompt,
  buildReturnDecisionPrompt,
} from "./prompts";
import { applyGuard, ensureDisclaimer, resolveGuardContext } from "./guard";
import {
  decisionResultSchema,
  type DecisionResult,
  type ImageAnalysis,
} from "./types";

/**
 * Decision stage of the AI pipeline (ADR-001 section 3 "decision", section 5).
 *
 * Calls the text model with the form, the vision analysis, and the matching
 * policy prose; gets a schema-validated `DecisionResult`; then runs the
 * deterministic hard-rule guard (`applyGuard`) before returning. The guard
 * may rewrite the category (window or usability rule) — when it does, the
 * model's `messageMarkdown` / `justification` no longer match the structured
 * category, so this module substitutes an explanatory Polish message so the
 * rendered first chat message never contradicts the stored decision
 * (T2.1 handoff note; ADR-001 section 7 "guard override" sequence).
 */

// --- Error type --------------------------------------------------------------

/**
 * Typed failure from the AI pipeline. Thrown by `analyzeImage` (vision) and
 * `makeDecision` (decision) on provider failure, timeout, or schema-invalid
 * model output — after the internal retry budget is exhausted (ADR-001
 * section 5, section 8 "Schema-invalid model output"). The `stage` field
 * lets route handlers and logs distinguish which half of the pipeline failed
 * without parsing the message.
 *
 * Defined here (not in `types.ts`, which is Zod schemas only) and imported
 * by `vision.ts` so the two stages share one typed error per the interface
 * contract in ADR-001 section 5.
 */
export class AiServiceError extends Error {
  /** Which pipeline stage failed. Defaults to `"decision"` (this module). */
  readonly stage: "vision" | "decision";

  constructor(
    message: string,
    options?: { cause?: unknown; stage?: "vision" | "decision" },
  ) {
    super(message, options);
    this.name = "AiServiceError";
    this.stage = options?.stage ?? "decision";
  }
}

// --- Options -----------------------------------------------------------------

export interface MakeDecisionOptions {
  /**
   * Language model to use instead of the env-resolved text model. Intended
   * for tests (mock provider); production callers leave this unset.
   */
  model?: LanguageModelV4;
  /**
   * Optional caller-supplied abort signal. Combined with the 90 s deadline so
   * either one cancels the call (ADR-001 section 5 timeouts).
   */
  abortSignal?: AbortSignal;
  /** Abort deadline in milliseconds. Defaults to 90_000 (ADR-001 section 5). */
  deadlineMs?: number;
  /**
   * "Today" injected into the guard's window check. Defaults to
   * `todayIsoDate()`; tests pass a fixed date for determinism.
   */
  today?: string;
}

export interface GuardedDecisionResult extends DecisionResult {
  /** True when the deterministic guard changed the model's category. */
  guardOverride: boolean;
}

// --- Constants ---------------------------------------------------------------

const DECISION_DEADLINE_MS = 90_000;

// --- Internal: schema-invalid detection --------------------------------------

/**
 * Returns true when an error thrown by `generateObject` means the model's
 * output failed schema validation or JSON parsing. In AI SDK 7,
 * `generateObject` collapses both cases into `NoObjectGeneratedError`
 * ("response did not match schema") regardless of the underlying cause, so
 * that single class is the authoritative signal. These are NOT retried:
 * the model is unlikely to self-correct on a second call within the same
 * deadline, and retrying would only add latency before the same failure
 * (ADR-001 section 8 "Schema-invalid model output").
 */
function isSchemaInvalidError(error: unknown): boolean {
  return error instanceof NoObjectGeneratedError;
}

// --- Internal: Polish fallback messages for guard-rewritten categories ------

/**
 * Builds the Polish first-message for a usability-forced ESCALATE: the photo
 * could not be assessed and the case is saved for manual employee review
 * (AC-10, PRD section 4.4). The disclaimer is appended by `ensureDisclaimer`
 * at the call site, so it is intentionally omitted here.
 */
function buildUnusableImageEscalateMessage(): string {
  return [
    "Dzień dobry,",
    "",
    "Niestety nie udało się ocenić przesłanego zdjęcia — jest ono niewyraźne lub nie przedstawia sprzętu w sposób, który pozwalałby na wiarygodną analizę. Z tego powodu nie możemy jeszcze wydać wstępnej decyzji.",
    "",
    "Państwa zgłoszenie zostało zapisane i trafiło do pracownika, który zweryfikuje je ręcznie. Skontaktujemy się z Państwem, aby uzupełnić lub wyjaśnić potrzebne informacje.",
  ].join("\n");
}

/**
 * Builds the Polish first-message for a window-forced ESCALATE: the request
 * is outside the policy window so an automated decision is impossible and the
 * case is escalated to a human, citing the window rule id (AC-15, PRD
 * section 4.6). The disclaimer is appended by `ensureDisclaimer` at the call
 * site, so it is intentionally omitted here.
 */
function buildWindowEscalateMessage(windowRuleId: string): string {
  return [
    "Dzień dobry,",
    "",
    `Zgłoszenie wykracza poza dopuszczalne okno czasowe określone w polityce (reguła ${windowRuleId}). Z tego powodu wstępna decyzja automatyczna nie jest możliwa — sprawa wymaga ręcznego przejrzenia przez pracownika.`,
    "",
    "Państwa zgłoszenie zostało zapisane i przekazane do analizy. Skontaktujemy się z Państwem z kolejnymi krokami.",
  ].join("\n");
}

// --- Public entry -------------------------------------------------------------

/**
 * Runs the decision stage and returns a guard-adjusted `DecisionResult`
 * (ADR-001 section 5 "makeDecision", section 7 sequence diagram).
 *
 * Behaviour:
 *  1. Loads the policy prose for the request type and builds the
 *     type-specific decision prompt.
 *  2. Calls the text model with `decisionResultSchema` (non-streaming,
 *     90 s abort deadline, one internal retry on transient failure).
 *  3. Wraps any provider/schema failure as `AiServiceError(stage: "decision")`.
 *  4. Builds a `GuardContext` (resolving window values from policy frontmatter
 *     and `imageUsable` from the stored analysis) and runs `applyGuard`.
 *  5. Handoff: when the guard rewrote the category, substitutes an explanatory
 *     Polish `messageMarkdown` + `justification` so the rendered message does
 *     not contradict the structured category. When the category was unchanged,
 *     keeps the model's text (only ensuring the disclaimer).
 */
export async function makeDecision(
  args: {
    requestType: RequestType;
    form: RequestFormInput;
    analysis: ImageAnalysis;
  },
  options?: MakeDecisionOptions,
): Promise<GuardedDecisionResult> {
  const model = options?.model ?? getTextModel();
  const policy = loadPolicy(args.requestType);
  const promptText =
    args.requestType === "complaint"
      ? buildComplaintDecisionPrompt(args.form, args.analysis, policy.prose)
      : buildReturnDecisionPrompt(args.form, args.analysis, policy.prose);

  const rawResult = await callDecisionModel(model, promptText, options);

  // Build the guard context and apply the deterministic rules.
  const today = options?.today ?? todayIsoDate();
  const ctx = resolveGuardContext(args.requestType, {
    today,
    purchaseDate: args.form.purchaseDate,
    imageUsable: args.analysis.imageUsable,
  });
  const guarded = applyGuard(rawResult, ctx);
  const guardOverride = guarded.decision !== rawResult.decision;

  // Handoff: substitute the visible message + justification when the guard
  // changed the category, so the message can never contradict the category.
  if (guardOverride) {
    if (!args.analysis.imageUsable) {
      // Usability-forced ESCALATE (AC-10, PRD section 4.4). citedRuleIds are
      // kept exactly as the guard returned them (window rule may also be
      // present when both rules fired).
      return {
        ...guarded,
        guardOverride,
        justification:
          `Zdjęcie nie mogło zostać ocenione przez system wizyjny (imageUsable=false); ` +
          `sprawa przekazana do pracownika do ręcznej weryfikacji.`,
        messageMarkdown: ensureDisclaimer(buildUnusableImageEscalateMessage()),
      };
    }
    // Window-forced ESCALATE (AC-15, PRD section 4.6). The guard already added
    // `windowRuleId` to `citedRuleIds`; cite it in the message + justification.
    return {
      ...guarded,
      guardOverride,
      justification:
        `Zgłoszenie wykracza poza okno polityki (reguła ${ctx.windowRuleId}); ` +
        `wymaga ręcznej decyzji pracownika.`,
      messageMarkdown: ensureDisclaimer(
        buildWindowEscalateMessage(ctx.windowRuleId),
      ),
    };
  }

  // Category unchanged: keep the model's text, only ensure the disclaimer.
  return {
    ...guarded,
    guardOverride,
    messageMarkdown: ensureDisclaimer(guarded.messageMarkdown),
  };
}

/**
 * Calls the text model once with retry-once semantics. Surfaces any failure
 * as `AiServiceError(stage: "decision")`. Schema-invalid output is NOT
 * retried (see `isSchemaInvalidError`).
 */
async function callDecisionModel(
  model: LanguageModelV4,
  promptText: string,
  options: MakeDecisionOptions | undefined,
): Promise<DecisionResult> {
  const deadlineMs = options?.deadlineMs ?? DECISION_DEADLINE_MS;
  const callOnce = (signal: AbortSignal) =>
    generateObject({
      model,
      schema: decisionResultSchema,
      schemaName: "DecisionResult",
      messages: [{ role: "user", content: promptText }],
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
        "Decision stage returned schema-invalid output.",
        { cause: error, stage: "decision" },
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
        "Decision stage failed after one internal retry.",
        { cause: retryError, stage: "decision" },
      );
    }
  }
}

/**
 * Builds an abort signal that fires on the earlier of the caller's signal
 * and the deadline. Used to give each LLM call a hard upper bound so the
 * analyze endpoint fails fast into the retry flow instead of hanging
 * (ADR-001 section 5 timeouts).
 */
function buildAbortSignal(callerSignal: AbortSignal | undefined, deadlineMs: number): AbortSignal {
  const deadline = AbortSignal.timeout(deadlineMs);
  if (callerSignal === undefined) return deadline;
  return AbortSignal.any([callerSignal, deadline]);
}
