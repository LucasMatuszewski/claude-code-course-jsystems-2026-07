import { describe, expect, it } from "vitest";
import {
  decisionSystemPrompt,
  imageAnalysisComplaintPrompt,
  imageAnalysisReturnPrompt,
} from "@/lib/ai/prompts";
import { pl } from "@/lib/copy/pl";
import type { CaseFormValues } from "@/lib/validation/case-form.schema";
import type { ImageAnalysis } from "@/lib/ai/schemas";

const baseForm: CaseFormValues = {
  requestType: "reklamacja",
  category: "Laptop",
  productName: "Dell XPS 13",
  purchaseDate: "2025-01-01",
  description: "Pęknięcie obudowy w okolicy zawiasu.",
  image: { mimeType: "image/jpeg", sizeBytes: 123456 },
};

const returnForm: CaseFormValues = {
  ...baseForm,
  requestType: "zwrot",
  description: undefined,
};

const sampleAnalysis: ImageAnalysis = {
  conclusive: true,
  damaged: true,
  damageType: "pęknięta obudowa",
  plausibleCause: "wada fabryczna",
  usageSigns: null,
  confidence: "high",
  customerFacingIssue: null,
  internalNotes: "Widoczne pęknięcie przy zawiasie, brak śladów uderzenia zewnętrznego.",
};

describe("imageAnalysisComplaintPrompt", () => {
  it("mentions damage-cause assessment and includes the form description", () => {
    const prompt = imageAnalysisComplaintPrompt(baseForm);
    expect(prompt).toMatch(/przyczyn/i);
    expect(prompt).toMatch(/wad(y|ę|a) fabryczn/i);
    expect(prompt).toContain(baseForm.description);
  });

  it("does not crash when description is missing", () => {
    expect(() => imageAnalysisComplaintPrompt({ ...baseForm, description: undefined })).not.toThrow();
  });
});

describe("imageAnalysisReturnPrompt", () => {
  it("mentions usage signs and resellability", () => {
    const prompt = imageAnalysisReturnPrompt(returnForm);
    expect(prompt).toMatch(/ślad(y|ów) użytkowania/i);
    expect(prompt).toMatch(/odsprzeda/i);
  });
});

describe("decisionSystemPrompt", () => {
  const policyMarkdown = "# Zasady zwrotów\n\nProdukt można zwrócić w ciągu 14 dni.";

  it("embeds the policy markdown, disclaimer, off-topic rule, and Polish-only instruction for zwrot", () => {
    const prompt = decisionSystemPrompt("zwrot", returnForm, sampleAnalysis, policyMarkdown);
    expect(prompt).toContain(policyMarkdown);
    expect(prompt).toContain(pl.chat.disclaimer);
    expect(prompt).toMatch(/tylko w j(ę|e)zyku polskim|wyłącznie po polsku/i);
    expect(prompt).toMatch(/off-?topic|niezwiązan/i);
  });

  it("differs between zwrot and reklamacja framing", () => {
    const zwrotPrompt = decisionSystemPrompt("zwrot", returnForm, sampleAnalysis, policyMarkdown);
    const reklamacjaPrompt = decisionSystemPrompt(
      "reklamacja",
      baseForm,
      sampleAnalysis,
      policyMarkdown,
    );
    expect(zwrotPrompt).not.toBe(reklamacjaPrompt);
    expect(reklamacjaPrompt).toMatch(/reklamacj/i);
    expect(zwrotPrompt).toMatch(/zwrot/i);
  });

  it("includes the form data and image analysis in the prompt", () => {
    const prompt = decisionSystemPrompt("reklamacja", baseForm, sampleAnalysis, policyMarkdown);
    expect(prompt).toContain(baseForm.productName);
    expect(prompt).toContain(sampleAnalysis.internalNotes);
  });

  it("distinguishes genuinely unrelated topics from the customer's own case-status/process questions (defect fix)", () => {
    const prompt = decisionSystemPrompt("reklamacja", baseForm, sampleAnalysis, policyMarkdown);
    // The prompt must explicitly allow answering status/process questions about
    // the customer's OWN case, even without an exact timeline.
    expect(prompt).toMatch(/status.*zgłoszenia|przebieg.*weryfikacji/i);
    // ...and explicitly say that such questions are NOT off-topic.
    expect(prompt).toMatch(/nie.*(jest\s+)?off-?topic|to nie jest.*off-?topic/i);
  });
});
