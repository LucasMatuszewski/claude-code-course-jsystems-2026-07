/**
 * Stage 2 (first decision) and Stage 3 (ongoing chat) of the AI pipeline
 * (ADR-002 §3). `decideInitial` is the committed, tested scope for this
 * task; the module is structured so a later `streamChatTurn` (ADR-002 §5,
 * `submitDecision` tool + `streamText`) can be added alongside it without
 * reshaping this file.
 */

import { generateText, Output } from "ai";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { DecisionSchema, type Decision, type ImageAnalysis } from "@/lib/ai/schemas";
import { decisionSystemPrompt } from "@/lib/ai/prompts";
import { AiProviderError } from "@/lib/ai/errors";
import type { CaseFormValues, RequestType } from "@/lib/validation/case-form.schema";
import { createModels } from "@/lib/ai/providers";

/**
 * Produces the first decision for a case: `generateText` with the text
 * model, `output: Output.object({ schema: DecisionSchema })`, and a system
 * prompt built fresh from the current form data, image analysis, and
 * policy markdown (ADR-002 §3). `model` defaults to the configured text
 * model but may be injected (tests pass a mock `LanguageModelV4`). Throws
 * `AiProviderError` on any provider failure.
 */
export async function decideInitial(
  requestType: RequestType,
  formData: CaseFormValues,
  imageAnalysis: ImageAnalysis,
  policyMarkdown: string,
  model: LanguageModelV4 = createModels().textModel,
): Promise<Decision> {
  const systemPrompt = decisionSystemPrompt(requestType, formData, imageAnalysis, policyMarkdown);

  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      output: Output.object({ schema: DecisionSchema }),
      prompt:
        "Wydaj wstępną decyzję dla tego zgłoszenia na podstawie powyższych danych i zasad.",
    });

    return result.output;
  } catch (error) {
    if (error instanceof AiProviderError) {
      throw error;
    }
    throw new AiProviderError("Decision generation failed.", error);
  }
}
