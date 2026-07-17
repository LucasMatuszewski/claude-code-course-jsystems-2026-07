import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4CallOptions } from "@ai-sdk/provider";
import type { RequestFormInput } from "@/lib/validation";
import { DISCLAIMER_PL } from "./prompts";
import type { ImageAnalysis } from "./types";
import { AiServiceError, makeDecision } from "./decision";

// --- Fixtures ----------------------------------------------------------------

function analysisFixture(overrides: Partial<ImageAnalysis> = {}): ImageAnalysis {
  return {
    imageUsable: true,
    unusableReason: null,
    matchesDeclaredProduct: true,
    damageVisible: false,
    damageDescription: null,
    plausibleCauses: null,
    usageSigns: null,
    resellableAssessment: null,
    confidence: "high",
    ...overrides,
  };
}

function formFixture(overrides: Partial<RequestFormInput> = {}): RequestFormInput {
  return {
    requestType: "return",
    category: "smartphone",
    productName: "Samsung Galaxy S22",
    purchaseDate: "2026-07-10",
    image: { type: "image/jpeg", size: 12345 },
    ...overrides,
  } as RequestFormInput;
}

const VALID_DECISION_JSON = JSON.stringify({
  decision: "APPROVE",
  justification: "Zgłoszenie spełnia warunki polityki (produkt w oknie, brak uszkodzeń).",
  citedRuleIds: [],
  missingInfo: null,
  messageMarkdown: "Dzień dobry.\n\nDecyzja: pozytywna.",
});

interface MockGenerateResult {
  content: Array<{ type: "text"; text: string }>;
  finishReason: "stop";
  usage: { inputTokens: number; outputTokens: number };
  warnings: unknown[];
}

type GenerateFn = (
  options: LanguageModelV4CallOptions,
) => Promise<MockGenerateResult>;

function makeMockModel(opts: {
  modelId?: string;
  json?: string;
  doGenerate?: GenerateFn;
} = {}) {
  const doGenerate: GenerateFn =
    opts.doGenerate ??
    (async () => ({
      content: [{ type: "text", text: opts.json ?? VALID_DECISION_JSON }],
      finishReason: "stop",
      usage: { inputTokens: 10, outputTokens: 5 },
      warnings: [],
    }));
  return new MockLanguageModelV4({
    modelId: opts.modelId ?? "openai/text-mock",
    doGenerate: doGenerate as unknown as Parameters<
      typeof MockLanguageModelV4
    >[0] extends { doGenerate?: infer F }
      ? F
      : never,
  });
}

// --- Happy path + disclaimer (model message preserved when guard passes) ----

describe("makeDecision — happy path", () => {
  it("returns the model's decision when in window and image usable", async () => {
    const mock = makeMockModel();
    const result = await makeDecision(
      {
        requestType: "return",
        form: formFixture({ purchaseDate: "2026-07-10" }),
        analysis: analysisFixture(),
      },
      { model: mock, today: "2026-07-16" },
    );
    expect(result.decision).toBe("APPROVE");
    // Model's justification/message are preserved when the guard didn't rewrite.
    expect(result.justification).toContain("spełnia warunki");
    expect(result.messageMarkdown).toContain("Decyzja: pozytywna.");
  });

  it("always appends the Polish disclaimer to messageMarkdown (TAC-001-03)", async () => {
    const mock = makeMockModel();
    const result = await makeDecision(
      {
        requestType: "return",
        form: formFixture(),
        analysis: analysisFixture(),
      },
      { model: mock, today: "2026-07-16" },
    );
    expect(result.messageMarkdown.endsWith(DISCLAIMER_PL)).toBe(true);
  });

  it("does not duplicate the disclaimer when the model already included it", async () => {
    const json = JSON.stringify({
      decision: "APPROVE",
      justification: "ok.",
      citedRuleIds: [],
      missingInfo: null,
      messageMarkdown: `Dzień dobry.\n\nDecyzja: pozytywna.\n\n${DISCLAIMER_PL}`,
    });
    const mock = makeMockModel({ json });
    const result = await makeDecision(
      {
        requestType: "return",
        form: formFixture(),
        analysis: analysisFixture(),
      },
      { model: mock, today: "2026-07-16" },
    );
    const occurrences = (
      result.messageMarkdown.match(/To jest wstępna ocena/g) ?? []
    ).length;
    expect(occurrences).toBe(1);
  });

  it("passes the injected model through to generateObject (TAC-001-05 wiring)", async () => {
    const mock = makeMockModel({ modelId: "openai/switched-text" });
    await makeDecision(
      {
        requestType: "return",
        form: formFixture(),
        analysis: analysisFixture(),
      },
      { model: mock, today: "2026-07-16" },
    );
    expect(mock.modelId).toBe("openai/switched-text");
    expect(mock.doGenerateCalls).toHaveLength(1);
  });
});

// --- Window guard override (AC-15, AC-22) ------------------------------------

describe("makeDecision — window guard override (AC-15)", () => {
  it("overrides an out-of-window APPROVE to ESCALATE and cites windowRuleId (R-1 for returns)", async () => {
    const mock = makeMockModel();
    // Return policy window_days = 14; 40 days ago is out of window.
    const result = await makeDecision(
      {
        requestType: "return",
        form: formFixture({ purchaseDate: "2026-06-06" }),
        analysis: analysisFixture(),
      },
      { model: mock, today: "2026-07-16" },
    );
    expect(result.decision).toBe("ESCALATE");
    expect(result.citedRuleIds).toContain("R-1");
  });

  it("substitutes a Polish message that cites the window rule when the guard rewrites (AC-15, PRD section 4.6)", async () => {
    const mock = makeMockModel();
    const result = await makeDecision(
      {
        requestType: "return",
        form: formFixture({ purchaseDate: "2026-06-06" }),
        analysis: analysisFixture(),
      },
      { model: mock, today: "2026-07-16" },
    );
    // Message must NOT contradict the structured ESCALATE category — no "pozytywna".
    expect(result.messageMarkdown).not.toMatch(/Decyzja: pozytywna/);
    // It must reference the window rule id (R-1) it cites.
    expect(result.messageMarkdown).toMatch(/R-1/);
    expect(result.messageMarkdown).toMatch(/okno|okna|oknem|oknach|okn/i);
    // Disclaimer preserved on the substituted message.
    expect(result.messageMarkdown.endsWith(DISCLAIMER_PL)).toBe(true);
    // Justification likewise rewritten to match ESCALATE.
    expect(result.justification).toMatch(/R-1/);
  });

  it("substitutes a Polish message citing C-1 on an out-of-window complaint (windowRuleId from complaint policy)", async () => {
    // Complaint window_days = 730; purchase 5 years ago is out of window.
    const mock = makeMockModel({ json: JSON.stringify({
      decision: "APPROVE",
      justification: "ok.",
      citedRuleIds: [],
      missingInfo: null,
      messageMarkdown: "Dzień dobry.\n\nDecyzja: pozytywna.",
    }) });
    const result = await makeDecision(
      {
        requestType: "complaint",
        form: formFixture({ requestType: "complaint", purchaseDate: "2021-07-16", reason: "Nie działa." }),
        analysis: analysisFixture(),
      },
      { model: mock, today: "2026-07-16" },
    );
    expect(result.decision).toBe("ESCALATE");
    expect(result.citedRuleIds).toContain("C-1");
    expect(result.messageMarkdown).toMatch(/C-1/);
    expect(result.messageMarkdown.endsWith(DISCLAIMER_PL)).toBe(true);
  });

  it("keeps the model's REJECT when out of window (REJECT is admissible) but still cites windowRuleId", async () => {
    const mock = makeMockModel({
      json: JSON.stringify({
        decision: "REJECT",
        justification: "Reguła R-4: widoczne ślady użytkowania.",
        citedRuleIds: ["R-4"],
        missingInfo: null,
        messageMarkdown: "Dzień dobry.\n\nDecyzja: odmowa.",
      }),
    });
    const result = await makeDecision(
      {
        requestType: "return",
        form: formFixture({ purchaseDate: "2026-06-06" }),
        analysis: analysisFixture(),
      },
      { model: mock, today: "2026-07-16" },
    );
    // Category is unchanged (REJECT admissible out of window) so the model's
    // justification/message must be preserved.
    expect(result.decision).toBe("REJECT");
    expect(result.justification).toContain("R-4");
    expect(result.messageMarkdown).toContain("Decyzja: odmowa.");
    // Window rule is still cited because the window guard fires regardless.
    expect(result.citedRuleIds).toContain("R-1");
  });
});

// --- Usability guard override (AC-10) ----------------------------------------

describe("makeDecision — usability guard override (AC-10)", () => {
  it("forces ESCALATE when the image is unusable, regardless of the model's category", async () => {
    const mock = makeMockModel(); // model says APPROVE
    const result = await makeDecision(
      {
        requestType: "return",
        form: formFixture(),
        analysis: analysisFixture({ imageUsable: false, unusableReason: "Zdjęcie rozmazane." }),
      },
      { model: mock, today: "2026-07-16" },
    );
    expect(result.decision).toBe("ESCALATE");
  });

  it("substitutes a Polish message stating the photo could not be assessed and the case is saved for employee review (AC-10, PRD section 4.4)", async () => {
    const mock = makeMockModel();
    const result = await makeDecision(
      {
        requestType: "return",
        form: formFixture(),
        analysis: analysisFixture({ imageUsable: false }),
      },
      { model: mock, today: "2026-07-16" },
    );
    expect(result.messageMarkdown).not.toMatch(/Decyzja: pozytywna/);
    // Must say the photo could not be assessed...
    expect(result.messageMarkdown).toMatch(/nie udało się ocenić|nie mogło zostać ocenione|nie można ocenić/i);
    // ...and that the case is saved for employee review.
    expect(result.messageMarkdown).toMatch(/pracownik/i);
    expect(result.messageMarkdown.endsWith(DISCLAIMER_PL)).toBe(true);
  });
});

// --- Error handling ----------------------------------------------------------

describe("makeDecision — error handling", () => {
  it("throws AiServiceError on schema-invalid model output", async () => {
    const mock = makeMockModel({
      doGenerate: async () => ({
        content: [{ type: "text", text: JSON.stringify({ decision: "BANANA" }) }],
        finishReason: "stop" as const,
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      }),
    });
    await expect(
      makeDecision(
        {
          requestType: "return",
          form: formFixture(),
          analysis: analysisFixture(),
        },
        { model: mock, today: "2026-07-16" },
      ),
    ).rejects.toBeInstanceOf(AiServiceError);
  });

  it("throws AiServiceError on persistent provider failure", async () => {
    const mock = makeMockModel({
      doGenerate: async () => {
        throw new Error("provider down");
      },
    });
    await expect(
      makeDecision(
        {
          requestType: "return",
          form: formFixture(),
          analysis: analysisFixture(),
        },
        { model: mock, today: "2026-07-16" },
      ),
    ).rejects.toBeInstanceOf(AiServiceError);
  });

  it("AiServiceError is tagged with stage='decision' by default", async () => {
    const mock = makeMockModel({
      doGenerate: async () => {
        throw new Error("down");
      },
    });
    try {
      await makeDecision(
        {
          requestType: "return",
          form: formFixture(),
          analysis: analysisFixture(),
        },
        { model: mock, today: "2026-07-16" },
      );
      throw new Error("expected makeDecision to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AiServiceError);
      expect((error as AiServiceError).stage).toBe("decision");
    }
  });
});

// --- AiServiceError shape ----------------------------------------------------

describe("AiServiceError", () => {
  it("exposes name, message, stage, and an optional cause", () => {
    const cause = new Error("root");
    const err = new AiServiceError("boom", { cause, stage: "vision" });
    expect(err.name).toBe("AiServiceError");
    expect(err.message).toBe("boom");
    expect(err.stage).toBe("vision");
    expect((err as { cause?: unknown }).cause).toBe(cause);
    expect(err instanceof Error).toBe(true);
  });

  it("defaults stage to 'decision' when omitted", () => {
    const err = new AiServiceError("boom");
    expect(err.stage).toBe("decision");
  });
});
