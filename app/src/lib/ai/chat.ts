import type { LanguageModelV4 } from "@ai-sdk/provider";
import { streamText, stepCountIs, tool, type ModelMessage } from "ai";
import { z } from "zod";

import { todayIsoDate } from "@/lib/validation";
import type { AppDatabase } from "@/lib/db/client";
import { appendDecision } from "@/lib/db/repositories";

import { applyGuard, resolveGuardContext } from "./guard";
import { buildChatSystemPrompt, type ChatSessionSummary } from "./prompts";
import { getTextModel } from "./provider";
import {
  decisionCategorySchema,
  type DecisionCategory,
  type DecisionResult,
} from "./types";

export interface ChatReplyFinishEvent {
  /** Final assistant message text (final streamText step). For persistence by T3.3. */
  text: string;
}

export interface StreamChatReplyOptions {
  /** DB handle the revise_decision tool writes through. */
  db: AppDatabase;
  /** Override the env-resolved text model. Tests pass a MockLanguageModelV4; prod omits. */
  model?: LanguageModelV4;
  /** "today" injected into the guard window check. Defaults to todayIsoDate(). */
  today?: string;
  /** Small multi-step cap. Defaults to DEFAULT_CHAT_STEP_CAP. */
  maxSteps?: number;
  /** Forwarded to streamText for cancellation. */
  abortSignal?: AbortSignal;
  /** Invoked when streaming + all tool executions finish; receives the final text. */
  onFinish?: (event: ChatReplyFinishEvent) => void | Promise<void>;
}

export const DEFAULT_CHAT_STEP_CAP = 3;
export const REVISE_DECISION_TOOL_NAME = "revise_decision";

export const reviseDecisionInputSchema = z.object({
  /** The revised category the model wants to record. */
  newDecision: decisionCategorySchema,
  /** Why the assessment changed (becomes the stored justification). */
  reason: z.string().min(1),
  /** Policy rule ids the model cites (guard may append the window rule id). */
  citedRuleIds: z.array(z.string()).default([]),
});
export type ReviseDecisionInput = z.infer<typeof reviseDecisionInputSchema>;

export const reviseDecisionOutputSchema = z.object({
  /** true when the guard did NOT override (recorded == requested). */
  accepted: z.boolean(),
  /** The category actually persisted (guard-adjusted). */
  recordedDecision: decisionCategorySchema,
  /** The previous decision this revision chained from (null if none). */
  previousDecision: decisionCategorySchema.nullable(),
  /** Guard's reason when it overrode; null otherwise. */
  overrideReason: z.enum(["out_of_window", "image_unusable"]).nullable(),
  /** citedRuleIds as persisted (may include the appended window rule id). */
  citedRuleIds: z.array(z.string()),
});
export type ReviseDecisionOutput = z.infer<typeof reviseDecisionOutputSchema>;

export function streamChatReply(
  session: ChatSessionSummary,
  history: ModelMessage[],
  options: StreamChatReplyOptions,
) {
  const model = options.model ?? getTextModel();
  const today = options.today ?? todayIsoDate();
  const maxSteps = options.maxSteps ?? DEFAULT_CHAT_STEP_CAP;

  const reviseDecision = tool({
    description:
      "Użyj, gdy ocena zgłoszenia zmienia się w rozmowie; serwer wymusi twarde reguły polityki.",
    inputSchema: reviseDecisionInputSchema,
    outputSchema: reviseDecisionOutputSchema,
    execute: async ({
      newDecision,
      reason,
      citedRuleIds,
    }): Promise<ReviseDecisionOutput> => {
      const ctx = resolveGuardContext(session.form.requestType, {
        today,
        purchaseDate: session.form.purchaseDate,
        imageUsable: session.analysis.imageUsable,
      });
      const candidate = {
        decision: newDecision,
        justification: reason,
        citedRuleIds,
        missingInfo: null,
        messageMarkdown: reason,
      } satisfies DecisionResult;
      const guarded = applyGuard(candidate, ctx);
      const guardOverride = guarded.decision !== newDecision;
      const overrideReason = guardOverride
        ? !ctx.imageUsable
          ? "image_unusable"
          : "out_of_window"
        : null;
      const row = appendDecision(options.db, session.sessionId, {
        decision: guarded.decision,
        justification: reason,
        citedRuleIds: guarded.citedRuleIds,
        source: "chat_revision",
        guardOverride,
      });

      return {
        accepted: !guardOverride,
        recordedDecision: guarded.decision,
        previousDecision: row.previousDecision as DecisionCategory | null,
        overrideReason,
        citedRuleIds: guarded.citedRuleIds,
      };
    },
  });

  const tools = { [REVISE_DECISION_TOOL_NAME]: reviseDecision };

  return streamText({
    model,
    system: buildChatSystemPrompt(session),
    messages: history,
    tools,
    stopWhen: stepCountIs(maxSteps),
    abortSignal: options.abortSignal,
    onFinish: async ({ text }) => {
      if (options.onFinish) {
        await options.onFinish({ text });
      }
    },
  });
}
