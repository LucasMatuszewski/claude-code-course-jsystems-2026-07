import { describe, expect, it } from "vitest";
import { DecisionSchema, ImageAnalysisSchema } from "@/lib/ai/schemas";

describe("ImageAnalysisSchema", () => {
  const validConclusive = {
    conclusive: true,
    damaged: true,
    damageType: "cracked hinge",
    plausibleCause: "manufacturing defect",
    usageSigns: null,
    confidence: "high",
    customerFacingIssue: null,
    internalNotes: "Visible crack along the left hinge, consistent with material fatigue.",
  };

  it("accepts a well-formed conclusive analysis", () => {
    const parsed = ImageAnalysisSchema.parse(validConclusive);
    expect(parsed).toMatchObject({ conclusive: true, damaged: true, confidence: "high" });
  });

  it("accepts an inconclusive analysis with nullable fields and a customer-facing issue", () => {
    const parsed = ImageAnalysisSchema.parse({
      conclusive: false,
      damaged: false,
      damageType: null,
      plausibleCause: null,
      usageSigns: null,
      confidence: "low",
      customerFacingIssue: "Zdjęcie jest zbyt rozmyte.",
      internalNotes: "Blurry, product edges not distinguishable.",
    });
    expect(parsed.conclusive).toBe(false);
    expect(parsed.customerFacingIssue).toBe("Zdjęcie jest zbyt rozmyte.");
  });

  it("rejects an invalid confidence value", () => {
    expect(() =>
      ImageAnalysisSchema.parse({ ...validConclusive, confidence: "very-high" }),
    ).toThrow();
  });

  it("rejects a missing required field (internalNotes)", () => {
    const rest: Record<string, unknown> = { ...validConclusive };
    delete rest.internalNotes;
    expect(() => ImageAnalysisSchema.parse(rest)).toThrow();
  });

  it("strips unknown fields returned by the model", () => {
    const parsed = ImageAnalysisSchema.parse({ ...validConclusive, hallucinatedField: 123 });
    expect(parsed).not.toHaveProperty("hallucinatedField");
  });
});

describe("DecisionSchema", () => {
  const validDecision = {
    status: "approved",
    justification: "Zgodnie z §2 zasad zwrotów produkt kwalifikuje się do zwrotu.",
    nextSteps: ["Zapakuj produkt.", "Wyślij paczkę na wskazany adres."],
    isRevision: false,
    requiresBetterPhoto: false,
  };

  it("accepts a well-formed decision", () => {
    expect(DecisionSchema.parse(validDecision)).toMatchObject({ status: "approved" });
  });

  it.each(["approved", "rejected", "needs_human_review"] as const)(
    "accepts status %s",
    (status) => {
      expect(DecisionSchema.parse({ ...validDecision, status }).status).toBe(status);
    },
  );

  it("rejects an unknown status", () => {
    expect(() => DecisionSchema.parse({ ...validDecision, status: "maybe" })).toThrow();
  });

  it("rejects a non-array nextSteps", () => {
    expect(() => DecisionSchema.parse({ ...validDecision, nextSteps: "do this" })).toThrow();
  });
});
