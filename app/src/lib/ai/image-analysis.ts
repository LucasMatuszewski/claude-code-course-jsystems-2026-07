/**
 * Stage 1 of the AI pipeline (ADR-002 §3): sends the compressed image to the
 * vision model with a role/request-type-specific prompt and returns a
 * validated `ImageAnalysis`. Uses `generateText` with
 * `output: Output.object(...)` — the deprecated object-generation helper
 * (see ADR-002 §3 note, TAC-002-01) is never imported anywhere in `src/`.
 */

import { generateText, Output } from "ai";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { ImageAnalysisSchema, type ImageAnalysis } from "@/lib/ai/schemas";
import { imageAnalysisComplaintPrompt, imageAnalysisReturnPrompt } from "@/lib/ai/prompts";
import { AiProviderError } from "@/lib/ai/errors";
import type { CaseFormValues, RequestType } from "@/lib/validation/case-form.schema";
import { createModels } from "@/lib/ai/providers";

/**
 * Analyzes one compressed image (`image/jpeg`) with the vision model,
 * using the complaint or return prompt depending on `requestType`.
 * `model` defaults to the configured vision model but may be injected
 * (tests pass a mock `LanguageModelV4`, e.g. `MockLanguageModelV4`).
 * Throws `AiProviderError` on any provider failure.
 */
export async function analyzeImage(
  requestType: RequestType,
  formData: CaseFormValues,
  compressedImageBuffer: Buffer,
  model: LanguageModelV4 = createModels().visionModel,
): Promise<ImageAnalysis> {
  const prompt =
    requestType === "reklamacja"
      ? imageAnalysisComplaintPrompt(formData)
      : imageAnalysisReturnPrompt(formData);

  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: ImageAnalysisSchema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "file", data: compressedImageBuffer, mediaType: "image/jpeg" },
          ],
        },
      ],
    });

    return result.output;
  } catch (error) {
    if (error instanceof AiProviderError) {
      throw error;
    }
    throw new AiProviderError("Image analysis failed.", error);
  }
}
