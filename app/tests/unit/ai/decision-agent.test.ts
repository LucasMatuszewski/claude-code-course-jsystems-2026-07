import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { decideInitial } from "@/lib/ai/decision-agent";
import { AiProviderError } from "@/lib/ai/errors";
import type { CaseFormValues } from "@/lib/validation/case-form.schema";
import type { ImageAnalysis } from "@/lib/ai/schemas";

const form: CaseFormValues = {
  requestType: "zwrot",
  category: "Słuchawki",
  productName: "Sony WH-1000XM5",
  purchaseDate: "2025-06-01",
  description: undefined,
  image: { mimeType: "image/jpeg", sizeBytes: 100000 },
};

const analysis: ImageAnalysis = {
  conclusive: true,
  damaged: false,
  damageType: null,
  plausibleCause: null,
  usageSigns: false,
  confidence: "high",
  customerFacingIssue: null,
  internalNotes: "Brak śladów użytkowania, oryginalne opakowanie widoczne.",
};

const policyMarkdown = "# Zasady zwrotów\n\nProdukt można zwrócić w ciągu 14 dni.";

const validDecisionJson = JSON.stringify({
  status: "approved",
  justification: "Zgodnie z zasadami zwrotów produkt nie nosi śladów użytkowania.",
  nextSteps: ["Zapakuj produkt.", "Wyślij paczkę na wskazany adres."],
  isRevision: false,
  requiresBetterPhoto: false,
});

function mockSuccessModel() {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: validDecisionJson }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

describe("decideInitial", () => {
  it("returns a validated Decision object", async () => {
    const model = mockSuccessModel();

    const result = await decideInitial("zwrot", form, analysis, policyMarkdown, model);

    expect(result.status).toBe("approved");
    expect(result.nextSteps).toHaveLength(2);
    expect(result.isRevision).toBe(false);
  });

  it("wraps a provider failure in AiProviderError", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("timeout");
      },
    });

    await expect(
      decideInitial("zwrot", form, analysis, policyMarkdown, model),
    ).rejects.toThrow(AiProviderError);
  });
});
