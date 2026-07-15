import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { analyzeImage } from "@/lib/ai/image-analysis";
import { AiProviderError } from "@/lib/ai/errors";
import type { CaseFormValues } from "@/lib/validation/case-form.schema";

const form: CaseFormValues = {
  requestType: "reklamacja",
  category: "Laptop",
  productName: "Dell XPS 13",
  purchaseDate: "2025-01-01",
  description: "Pęknięcie obudowy w okolicy zawiasu.",
  image: { mimeType: "image/jpeg", sizeBytes: 123456 },
};

const validAnalysisJson = JSON.stringify({
  conclusive: true,
  damaged: true,
  damageType: "pęknięta obudowa",
  plausibleCause: "wada fabryczna",
  usageSigns: null,
  confidence: "high",
  customerFacingIssue: null,
  internalNotes: "Widoczne pęknięcie przy zawiasie.",
});

function mockSuccessModel() {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: validAnalysisJson }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

describe("analyzeImage", () => {
  it("sends exactly one text part and one image/jpeg file part to the vision model", async () => {
    const model = mockSuccessModel();
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

    await analyzeImage("reklamacja", form, buffer, model);

    expect(model.doGenerateCalls).toHaveLength(1);
    const call = model.doGenerateCalls[0];
    const userMessage = call.prompt.find((m) => m.role === "user");
    expect(userMessage).toBeDefined();
    const content = userMessage!.content as Array<Record<string, unknown>>;
    const textParts = content.filter((p) => p.type === "text");
    const fileParts = content.filter((p) => p.type === "file");
    expect(textParts).toHaveLength(1);
    expect(fileParts).toHaveLength(1);
    expect(fileParts[0].mediaType).toBe("image/jpeg");
  });

  it("returns a validated ImageAnalysis object", async () => {
    const model = mockSuccessModel();
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

    const result = await analyzeImage("reklamacja", form, buffer, model);

    expect(result.conclusive).toBe(true);
    expect(result.damaged).toBe(true);
    expect(result.confidence).toBe("high");
  });

  it("wraps a provider failure in AiProviderError", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("network boom");
      },
    });
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

    await expect(analyzeImage("zwrot", form, buffer, model)).rejects.toThrow(AiProviderError);
  });
});
