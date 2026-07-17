import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4CallOptions } from "@ai-sdk/provider";
import type { RequestFormInput } from "@/lib/validation";
import { analyzeImage } from "./vision";
import { AiServiceError } from "./decision";

// --- Fixtures ----------------------------------------------------------------

function formFixture(overrides: Partial<RequestFormInput> = {}): RequestFormInput {
  return {
    requestType: "complaint",
    category: "smartphone",
    productName: "Samsung Galaxy S22",
    purchaseDate: "2026-06-01",
    reason: "Ekran się nie włącza.",
    image: { type: "image/jpeg", size: 12345 },
    ...overrides,
  } as RequestFormInput;
}

const VALID_ANALYSIS_JSON = JSON.stringify({
  imageUsable: true,
  unusableReason: null,
  matchesDeclaredProduct: true,
  damageVisible: true,
  damageDescription: "Pęknięty ekran w lewym górnym rogu.",
  plausibleCauses: "Uszkodzenie mechaniczne z punktem uderzenia.",
  usageSigns: null,
  resellableAssessment: null,
  confidence: "high",
});

interface MockGenerateResult {
  content: Array<{ type: "text"; text: string }>;
  finishReason: "stop";
  usage: { inputTokens: number; outputTokens: number };
  warnings: unknown[];
}

function okResult(json: string = VALID_ANALYSIS_JSON): MockGenerateResult {
  return {
    content: [{ type: "text", text: json }],
    finishReason: "stop",
    usage: { inputTokens: 10, outputTokens: 5 },
    warnings: [],
  };
}

type GenerateFn = (
  options: LanguageModelV4CallOptions,
) => Promise<MockGenerateResult>;

function makeMockModel(opts: { modelId?: string; doGenerate?: GenerateFn } = {}) {
  const doGenerate: GenerateFn =
    opts.doGenerate ?? (async () => okResult());
  return new MockLanguageModelV4({
    modelId: opts.modelId ?? "openai/vision-mock",
    doGenerate: doGenerate as unknown as Parameters<
      typeof MockLanguageModelV4
    >[0] extends { doGenerate?: infer F }
      ? F
      : never,
  });
}

/** Extracts every text part across all messages of a single model call prompt. */
function textOfCall(call: LanguageModelV4CallOptions): string {
  const prompt = call.prompt as unknown as Array<{
    content: Array<{ type: string; text?: string }>;
  }>;
  return prompt
    .flatMap((message) => message.content)
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n");
}

/** Counts file parts across all messages of a single model call prompt. */
function filePartsOf(call: LanguageModelV4CallOptions) {
  const prompt = call.prompt as unknown as Array<{
    content: Array<{ type: string; mediaType?: string }>;
  }>;
  return prompt
    .flatMap((message) => message.content)
    .filter((part) => part.type === "file");
}

// --- Happy path --------------------------------------------------------------

describe("analyzeImage — happy path", () => {
  it("returns a schema-valid ImageAnalysis from the model output", async () => {
    const mock = makeMockModel();
    const result = await analyzeImage(
      Buffer.from("fake-jpeg-bytes"),
      { requestType: "complaint", form: formFixture() },
      { model: mock },
    );
    expect(result.imageUsable).toBe(true);
    expect(result.damageVisible).toBe(true);
    expect(result.confidence).toBe("high");
    expect(result.damageDescription).toContain("Pęknięty ekran");
  });

  it("sends the image exactly once per analyze run as an image/jpeg file part (TAC-001-04)", async () => {
    const mock = makeMockModel();
    await analyzeImage(
      Buffer.from("fake-jpeg-bytes"),
      { requestType: "complaint", form: formFixture() },
      { model: mock },
    );
    expect(mock.doGenerateCalls).toHaveLength(1);
    const files = filePartsOf(mock.doGenerateCalls[0]);
    expect(files).toHaveLength(1);
    expect(files[0]?.mediaType).toBe("image/jpeg");
  });

  it("sends the raw buffer bytes (no base64 pre-encoding by the caller)", async () => {
    const mock = makeMockModel();
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG SOI marker bytes
    await analyzeImage(
      buf,
      { requestType: "complaint", form: formFixture() },
      { model: mock },
    );
    const prompt = mock.doGenerateCalls[0].prompt as unknown as Array<{
      content: Array<{ type: string; data?: unknown }>;
    }>;
    const filePart = prompt
      .flatMap((m) => m.content)
      .find((p) => p.type === "file");
    expect(filePart).toBeDefined();
    // At the provider boundary the AI SDK normalizes file data to the tagged
    // shape `{ type: 'data', data: <bytes|base64> }` (SharedV4FileData). Unwrap
    // it, then assert the bytes round-trip regardless of raw-vs-base64 form.
    const raw = filePart?.data;
    const inner =
      raw !== null && typeof raw === "object" && "data" in (raw as object)
        ? (raw as { data: unknown }).data
        : raw;
    const asBytes =
      inner instanceof Uint8Array
        ? inner
        : typeof inner === "string"
          ? Buffer.from(inner, "base64")
          : Buffer.isBuffer(inner)
            ? (inner as Buffer)
            : undefined;
    expect(asBytes).toBeDefined();
    expect(asBytes && asBytes.length).toBeGreaterThan(0);
    expect(asBytes && asBytes[0]).toBe(0xff);
  });

  it("uses the complaint vision prompt for complaints", async () => {
    const mock = makeMockModel();
    await analyzeImage(
      Buffer.from("x"),
      { requestType: "complaint", form: formFixture() },
      { model: mock },
    );
    expect(textOfCall(mock.doGenerateCalls[0])).toMatch(/REKLAMACJA/i);
  });

  it("uses the return vision prompt for returns", async () => {
    const mock = makeMockModel();
    await analyzeImage(
      Buffer.from("x"),
      { requestType: "return", form: formFixture({ requestType: "return" }) },
      { model: mock },
    );
    expect(textOfCall(mock.doGenerateCalls[0])).toMatch(/ZWROT/i);
  });

  it("passes the injected model through to generateObject (TAC-001-05 wiring)", async () => {
    const mock = makeMockModel({ modelId: "openai/switched-vision" });
    await analyzeImage(
      Buffer.from("x"),
      { requestType: "complaint", form: formFixture() },
      { model: mock },
    );
    expect(mock.modelId).toBe("openai/switched-vision");
    expect(mock.doGenerateCalls).toHaveLength(1);
  });
});

// --- Retry + error handling (ADR-001 section 5: one internal retry) -----------

describe("analyzeImage — retry and error handling", () => {
  it("retries once on a transient provider error and returns the successful result", async () => {
    let calls = 0;
    const mock = makeMockModel({
      doGenerate: async () => {
        calls += 1;
        if (calls === 1) {
          const err = new Error("transient HTTP 503");
          err.name = "APICallError";
          throw err;
        }
        return okResult();
      },
    });
    const result = await analyzeImage(
      Buffer.from("x"),
      { requestType: "complaint", form: formFixture() },
      { model: mock },
    );
    expect(calls).toBe(2);
    expect(result.imageUsable).toBe(true);
  });

  it("throws AiServiceError after retry exhausts on persistent provider failure", async () => {
    const mock = makeMockModel({
      doGenerate: async () => {
        throw new Error("persistently down");
      },
    });
    await expect(
      analyzeImage(
        Buffer.from("x"),
        { requestType: "complaint", form: formFixture() },
        { model: mock },
      ),
    ).rejects.toBeInstanceOf(AiServiceError);
    // Two attempts: initial + one retry.
    expect(mock.doGenerateCalls).toHaveLength(2);
  });

  it("throws AiServiceError WITHOUT retry on schema-invalid model output", async () => {
    const mock = makeMockModel({
      doGenerate: async () =>
        okResult(JSON.stringify({ imageUsable: "definitely-not-a-boolean" })),
    });
    await expect(
      analyzeImage(
        Buffer.from("x"),
        { requestType: "complaint", form: formFixture() },
        { model: mock },
      ),
    ).rejects.toBeInstanceOf(AiServiceError);
    // No retry on schema-invalid: only one attempt.
    expect(mock.doGenerateCalls).toHaveLength(1);
  });

  it("throws AiServiceError on non-JSON model output (no retry)", async () => {
    const mock = makeMockModel({
      doGenerate: async () => okResult("<<not json at all>>"),
    });
    await expect(
      analyzeImage(
        Buffer.from("x"),
        { requestType: "complaint", form: formFixture() },
        { model: mock },
      ),
    ).rejects.toBeInstanceOf(AiServiceError);
    expect(mock.doGenerateCalls).toHaveLength(1);
  });

  it("AiServiceError from vision is tagged with stage='vision'", async () => {
    const mock = makeMockModel({
      doGenerate: async () => okResult("<<not json>>"),
    });
    try {
      await analyzeImage(
        Buffer.from("x"),
        { requestType: "complaint", form: formFixture() },
        { model: mock },
      );
      throw new Error("expected analyzeImage to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AiServiceError);
      expect((error as AiServiceError).stage).toBe("vision");
    }
  });
});
