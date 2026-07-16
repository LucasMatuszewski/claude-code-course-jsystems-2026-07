import { describe, expect, it } from "vitest";
import type { ImageAnalysis, DecisionResult } from "./types";
import {
  DISCLAIMER_PL,
  buildChatSystemPrompt,
  buildComplaintDecisionPrompt,
  buildComplaintVisionPrompt,
  buildReturnDecisionPrompt,
  buildReturnVisionPrompt,
  type ChatSessionSummary,
} from "./prompts";
import type { RequestFormInput } from "@/lib/validation";

// --- Fixtures ---------------------------------------------------------------

function validImage() {
  return { type: "image/jpeg", size: 1024 };
}

function baseComplaintForm(overrides: Partial<RequestFormInput> = {}): RequestFormInput {
  return {
    requestType: "complaint",
    category: "smartphone",
    productName: "Samsung Galaxy S22",
    purchaseDate: "2026-06-01",
    reason: "Pęknięty ekran po kilku dniach użytkowania.",
    image: validImage(),
    ...overrides,
  };
}

function baseReturnForm(overrides: Partial<RequestFormInput> = {}): RequestFormInput {
  return {
    requestType: "return",
    category: "audio",
    productName: "Sony WH-1000XM5",
    purchaseDate: "2026-07-10",
    reason: undefined,
    image: validImage(),
    ...overrides,
  };
}

function baseAnalysis(overrides: Partial<ImageAnalysis> = {}): ImageAnalysis {
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

const POLICY_PROSE = `# Return Policy (example)

1. Returns accepted within 14 days of purchase (rule R-1).
2. Product must be unused and resellable as new (rule R-4).`;

const COMPLAINT_PROSE = `# Complaint Policy (example)

1. Manufacturing defects covered for 24 months (rule C-1).
2. User-caused mechanical damage is not covered (rule C-6).`;

// --- The exact disclaimer from PRD section 11 -------------------------------

describe("DISCLAIMER_PL", () => {
  it("matches the PRD section 11 mandatory disclaimer wording", () => {
    // PRD section 11 "Mandatory disclaimer": „To jest wstępna ocena —
    // ostateczną decyzję potwierdzi nasz pracownik."
    expect(DISCLAIMER_PL).toBe(
      "To jest wstępna ocena — ostateczną decyzję potwierdzi nasz pracownik."
    );
  });

  it("is non-empty and Polish", () => {
    expect(DISCLAIMER_PL.length).toBeGreaterThan(10);
    // sanity: contains the Polish word for "preliminary"
    expect(DISCLAIMER_PL).toContain("wstępna");
  });
});

// --- Shared prompt-content expectations -------------------------------------

/**
 * Asserts the prompt: (a) is non-empty, (b) embeds every form field value
 * the customer provided, (c) carries the Polish-output directive (PRD
 * section 11 "Language and tone").
 */
function expectPromptEmbedsFormAndPolish(prompt: string, form: RequestFormInput) {
  expect(prompt.length).toBeGreaterThan(0);
  expect(prompt).toContain(form.productName);
  expect(prompt).toContain(form.category);
  expect(prompt).toContain(form.purchaseDate);
  expect(prompt).toContain(form.image.type);
  // Polish-output directive (PRD section 11 "Language and tone").
  expect(prompt.toLowerCase()).toMatch(/po polsku|języ[zs]iem polskim|w j[eę]zyku polskim|polish/i);
}

// --- Vision prompt builders -------------------------------------------------

describe("buildComplaintVisionPrompt", () => {
  it("embeds the form values and a Polish-output directive", () => {
    const form = baseComplaintForm();
    const prompt = buildComplaintVisionPrompt(form);
    expectPromptEmbedsFormAndPolish(prompt, form);
  });

  it("asks for damage description AND plausible causes (complaint-specific criteria, AC-09)", () => {
    const prompt = buildComplaintVisionPrompt(baseComplaintForm());
    // Complaint variant must mention damage and its plausible cause
    // (manufacturing defect vs. user-caused) — ADR-001 section 8
    // "Prompt assembly per type".
    expect(prompt.toLowerCase()).toContain("uszkod");
    expect(prompt).toMatch(/wada fabryczna|przyczyna|wady fabryczne|mechaniczn/i);
  });

  it("embeds the customer-supplied reason text when present", () => {
    const form = baseComplaintForm({ reason: "Pęknięty ekran po kilku dniach użytkowania." });
    expect(buildComplaintVisionPrompt(form)).toContain(form.reason as string);
  });
});

describe("buildReturnVisionPrompt", () => {
  it("embeds the form values and a Polish-output directive", () => {
    const form = baseReturnForm();
    const prompt = buildReturnVisionPrompt(form);
    expectPromptEmbedsFormAndPolish(prompt, form);
  });

  it("asks about resellability and signs of usage (return-specific criteria, AC-09)", () => {
    const prompt = buildReturnVisionPrompt(baseReturnForm());
    // Return variant must mention resellability / completeness / signs of
    // usage — ADR-001 section 8.
    expect(prompt).toMatch(/odsprzeda|[rs]esell|kompletn|znak[oó]w u[żz]ytkowani|stanu/i);
  });

  it("does not require the reason field (returns: reason optional)", () => {
    const form = baseReturnForm({ reason: undefined });
    expect(() => buildReturnVisionPrompt(form)).not.toThrow();
    expect(buildReturnVisionPrompt(form).length).toBeGreaterThan(0);
  });
});

// --- Decision prompt builders -----------------------------------------------

describe("buildComplaintDecisionPrompt", () => {
  it("embeds the policy prose, form values, analysis, and Polish-output directive", () => {
    const form = baseComplaintForm();
    const analysis = baseAnalysis({ damageVisible: true, damageDescription: "Pęknięcie ekranu", plausibleCauses: "Uszkodzenie mechaniczne" });
    const prompt = buildComplaintDecisionPrompt(form, analysis, COMPLAINT_PROSE);

    expectPromptEmbedsFormAndPolish(prompt, form);
    // Policy prose is embedded verbatim.
    expect(prompt).toContain(COMPLAINT_PROSE);
    // Analysis findings are surfaced for the decision stage.
    expect(prompt).toContain(analysis.damageDescription as string);
    // Complaint-specific criterion.
    expect(prompt.toLowerCase()).toContain("uszkod");
  });
});

describe("buildReturnDecisionPrompt", () => {
  it("embeds the policy prose, form values, analysis, and Polish-output directive", () => {
    const form = baseReturnForm();
    const analysis = baseAnalysis({
      usageSigns: "Brak widocznych śladów użytkowania",
      resellableAssessment: "Produkt kompletny, nadaje się do odsprzedaży jako nowy",
    });
    const prompt = buildReturnDecisionPrompt(form, analysis, POLICY_PROSE);

    expectPromptEmbedsFormAndPolish(prompt, form);
    expect(prompt).toContain(POLICY_PROSE);
    expect(prompt).toContain(analysis.resellableAssessment as string);
    // Return-specific criterion.
    expect(prompt).toMatch(/odsprzeda|[rs]esell|kompletn/i);
  });
});

// --- Chat system prompt -----------------------------------------------------

describe("buildChatSystemPrompt", () => {
  function baseSession(overrides: Partial<ChatSessionSummary> = {}): ChatSessionSummary {
    return {
      form: baseComplaintForm(),
      analysis: baseAnalysis(),
      decisionHistory: [
        { category: "MORE_INFO", justification: "Brakuje opisu kiedy wystąpiła usterka.", timestamp: "2026-07-16T10:00:00Z" },
      ],
      policyProse: COMPLAINT_PROSE,
      sessionId: "sess-123",
      ...overrides,
    };
  }

  it("embeds the session ID, decision history, policy prose, form, and analysis", () => {
    const session = baseSession();
    const prompt = buildChatSystemPrompt(session);

    expect(prompt).toContain(session.sessionId);
    expect(prompt).toContain(session.policyProse);
    expect(prompt).toContain(session.form.productName);
    expect(prompt).toContain(session.decisionHistory[0].category);
    expect(prompt).toContain(session.decisionHistory[0].justification);
    expect(prompt).toContain(session.analysis.confidence);
  });

  it("enforces Polish-only output and polite form (PRD section 11 tone)", () => {
    const prompt = buildChatSystemPrompt(baseSession());
    expect(prompt.toLowerCase()).toMatch(/po polsku|w j[eę]zyku polskim|polish/i);
    // polite form directive ("Państwo" / "Pan/Pani")
    expect(prompt).toMatch(/Pa[nń]stwo|Pan\/Pani|Pan\/Pani/i);
  });

  it("instructs the agent to refuse off-topic questions and redirect (PRD section 11)", () => {
    const prompt = buildChatSystemPrompt(baseSession());
    expect(prompt.toLowerCase()).toMatch(/poza tematem|nie na temat|off-topic|nie zwi[eą]zan/i);
  });

  it("instructs the agent to never contradict a hard policy rule (AC-22)", () => {
    const prompt = buildChatSystemPrompt(baseSession());
    // The agent must escalate, not approve, when a hard rule blocks.
    expect(prompt).toMatch(/ESCALATE|eskalacj/i);
  });

  it("renders without throwing when decision history is empty (first turn)", () => {
    const session = baseSession({ decisionHistory: [] });
    expect(() => buildChatSystemPrompt(session)).not.toThrow();
    expect(buildChatSystemPrompt(session).length).toBeGreaterThan(0);
  });
});

// --- Unused-import guard (keeps DecisionResult type referenced) -------------

it("DecisionResult type is exported from types for downstream modules", () => {
  const sample: DecisionResult = {
    decision: "APPROVE",
    justification: "x",
    citedRuleIds: [],
    missingInfo: null,
    messageMarkdown: "y",
  };
  expect(sample.decision).toBe("APPROVE");
});
