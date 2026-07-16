import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PolicyConfigError } from "@/lib/policies";
import type { DecisionResult } from "./types";
import {
  applyGuard,
  daysBetween,
  enforceUsability,
  enforceWindow,
  ensureDisclaimer,
  isWithinWindow,
  type GuardContext,
} from "./guard";

// --- Fixtures ----------------------------------------------------------------

function decision(overrides: Partial<DecisionResult> = {}): DecisionResult {
  return {
    decision: "APPROVE",
    justification: "Wniosek spełnia warunki polityki.",
    citedRuleIds: [],
    missingInfo: null,
    messageMarkdown: "Dzień dobry.\n\nDecyzja: pozytywna.",
    ...overrides,
  };
}

function ctx(overrides: Partial<GuardContext> = {}): GuardContext {
  return {
    purchaseDate: "2026-06-01",
    today: "2026-06-15",
    windowDays: 14,
    windowRuleId: "R-1",
    imageUsable: true,
    ...overrides,
  };
}

// --- daysBetween: calendar-day math including leap years ---------------------

describe("daysBetween", () => {
  it("counts 1 day across a non-leap February month boundary", () => {
    expect(daysBetween("2023-02-28", "2023-03-01")).toBe(1);
  });

  it("counts 1 day across a leap-year February day (2024-02-29 exists)", () => {
    expect(daysBetween("2024-02-28", "2024-02-29")).toBe(1);
    expect(daysBetween("2024-02-29", "2024-03-01")).toBe(1);
  });

  it("knows 2024 has 366 days (leap year) and 2023 has 365", () => {
    expect(daysBetween("2024-01-01", "2024-12-31")).toBe(365);
    expect(daysBetween("2023-01-01", "2023-12-31")).toBe(364);
  });

  it("returns 0 for the same date and a positive number when to > from", () => {
    expect(daysBetween("2026-07-16", "2026-07-16")).toBe(0);
    expect(daysBetween("2026-07-10", "2026-07-16")).toBe(6);
  });
});

// --- isWithinWindow: boundary semantics -------------------------------------

describe("isWithinWindow", () => {
  it("allows a purchase exactly windowDays old (boundary inclusive)", () => {
    // 14 days between 2026-06-01 and 2026-06-15
    expect(isWithinWindow("2026-06-01", "2026-06-15", 14)).toBe(true);
  });

  it("blocks a purchase one day older than windowDays", () => {
    // 15 days between 2026-06-01 and 2026-06-16
    expect(isWithinWindow("2026-06-01", "2026-06-16", 14)).toBe(false);
  });

  it("handles a leap-day purchase date without corrupting the count", () => {
    // 2024-02-15 + 14 days = 2024-02-29 (leap day in path)
    expect(isWithinWindow("2024-02-15", "2024-02-29", 14)).toBe(true);
    expect(isWithinWindow("2024-02-15", "2024-03-01", 14)).toBe(false);
  });

  it("allows a purchase made today", () => {
    expect(isWithinWindow("2026-07-16", "2026-07-16", 14)).toBe(true);
  });
});

// --- enforceUsability: unusable image forces ESCALATE -----------------------

describe("enforceUsability", () => {
  it("forces APPROVE -> ESCALATE when the image is unusable (AC-10)", () => {
    expect(enforceUsability("APPROVE", false)).toBe("ESCALATE");
  });

  it("forces REJECT -> ESCALATE when the image is unusable (AC-10)", () => {
    expect(enforceUsability("REJECT", false)).toBe("ESCALATE");
  });

  it("forces MORE_INFO -> ESCALATE when the image is unusable (TAC-001-02: ESCALATE only)", () => {
    expect(enforceUsability("MORE_INFO", false)).toBe("ESCALATE");
  });

  it("leaves ESCALATE untouched when the image is unusable", () => {
    expect(enforceUsability("ESCALATE", false)).toBe("ESCALATE");
  });

  it("passes every category through when the image is usable", () => {
    const categories = ["APPROVE", "REJECT", "MORE_INFO", "ESCALATE"] as const;
    for (const c of categories) {
      expect(enforceUsability(c, true)).toBe(c);
    }
  });
});

// --- enforceWindow: out-of-window blocks APPROVE/MORE_INFO ------------------

describe("enforceWindow", () => {
  const outOfWindow = { purchaseDate: "2026-06-01", today: "2026-06-20", windowDays: 14 };
  const inWindow = { purchaseDate: "2026-06-01", today: "2026-06-15", windowDays: 14 };

  it("forces APPROVE -> ESCALATE when the purchase is out of window (AC-15, AC-22)", () => {
    expect(enforceWindow("APPROVE", outOfWindow)).toBe("ESCALATE");
  });

  it("forces MORE_INFO -> ESCALATE when out of window (cannot decide a stale case)", () => {
    expect(enforceWindow("MORE_INFO", outOfWindow)).toBe("ESCALATE");
  });

  it("leaves REJECT admissible when out of window (AC-15: REJECT or ESCALATE)", () => {
    expect(enforceWindow("REJECT", outOfWindow)).toBe("REJECT");
  });

  it("leaves ESCALATE admissible when out of window", () => {
    expect(enforceWindow("ESCALATE", outOfWindow)).toBe("ESCALATE");
  });

  it("passes every category through when still in window", () => {
    const categories = ["APPROVE", "REJECT", "MORE_INFO", "ESCALATE"] as const;
    for (const c of categories) {
      expect(enforceWindow(c, inWindow)).toBe(c);
    }
  });
});

// --- ensureDisclaimer: idempotent ------------------------------------------

describe("ensureDisclaimer", () => {
  it("appends the disclaimer when missing", () => {
    const out = ensureDisclaimer("Decyzja: pozytywna.");
    expect(out.endsWith("To jest wstępna ocena — ostateczną decyzję potwierdzi nasz pracownik.")).toBe(true);
    expect(out).toContain("Decyzja: pozytywna.");
  });

  it("does not duplicate the disclaimer when already present at the end", () => {
    const text = "Decyzja.\n\nTo jest wstępna ocena — ostateczną decyzję potwierdzi nasz pracownik.";
    expect(ensureDisclaimer(text)).toBe(text);
  });

  it("is idempotent: applying it twice yields exactly one disclaimer", () => {
    const once = ensureDisclaimer("Wiadomość.");
    const twice = ensureDisclaimer(once);
    expect(twice).toBe(once);
    const occurrences = (twice.match(/ostateczną decyzję potwierdzi/g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});

// --- applyGuard: full pipeline on the initial-decision call site -----------

describe("applyGuard — initial decision", () => {
  it("passes an APPROVE through when in window and image usable, and appends the disclaimer", () => {
    const result = applyGuard(decision(), ctx());
    expect(result.decision).toBe("APPROVE");
    expect(result.citedRuleIds).toEqual([]);
    expect(result.messageMarkdown).toMatch(/ostateczną decyzję potwierdzi/);
  });

  it("overrides APPROVE to ESCALATE when out of window, and cites windowRuleId (AC-14, AC-15)", () => {
    const result = applyGuard(decision({ decision: "APPROVE" }), ctx({ purchaseDate: "2026-06-01", today: "2026-06-20", windowDays: 14, windowRuleId: "R-1" }));
    expect(result.decision).toBe("ESCALATE");
    expect(result.citedRuleIds).toContain("R-1");
  });

  it("leaves REJECT admissible when out of window, but still cites windowRuleId", () => {
    const result = applyGuard(decision({ decision: "REJECT" }), ctx({ purchaseDate: "2026-06-01", today: "2026-06-20", windowDays: 14, windowRuleId: "R-1" }));
    expect(result.decision).toBe("REJECT");
    expect(result.citedRuleIds).toContain("R-1");
  });

  it("forces ESCALATE when image is unusable regardless of model category (TAC-001-02)", () => {
    for (const c of ["APPROVE", "REJECT", "MORE_INFO"] as const) {
      const result = applyGuard(decision({ decision: c }), ctx({ imageUsable: false }));
      expect(result.decision).toBe("ESCALATE");
    }
  });

  it("forces ESCALATE and cites windowRuleId when both image is unusable AND out of window", () => {
    const result = applyGuard(decision({ decision: "APPROVE" }), ctx({ imageUsable: false, purchaseDate: "2026-06-01", today: "2026-06-30", windowDays: 14, windowRuleId: "R-1" }));
    expect(result.decision).toBe("ESCALATE");
    expect(result.citedRuleIds).toContain("R-1");
  });

  it("never duplicates the disclaimer", () => {
    const alreadyHas = decision({
      messageMarkdown: "Decyzja.\n\nTo jest wstępna ocena — ostateczną decyzję potwierdzi nasz pracownik.",
    });
    const result = applyGuard(alreadyHas, ctx());
    const occurrences = (result.messageMarkdown.match(/ostateczną decyzję potwierdzi/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it("does not mutate the input result object (purity)", () => {
    const input = decision();
    const snapshot = JSON.parse(JSON.stringify(input)) as DecisionResult;
    applyGuard(input, ctx());
    expect(input).toEqual(snapshot);
  });
});

// --- applyGuard: same rules on the chat-revision call site ------------------

describe("applyGuard — chat revision (same rules apply on the revise_decision path)", () => {
  it("overrides a revision to APPROVE on an out-of-window session to ESCALATE (AC-22)", () => {
    const revised = decision({ decision: "APPROVE", justification: "Klient dostarczył nowe informacje." });
    const result = applyGuard(revised, ctx({ purchaseDate: "2026-06-01", today: "2026-06-30", windowDays: 14, windowRuleId: "R-1" }));
    expect(result.decision).toBe("ESCALATE");
    expect(result.citedRuleIds).toContain("R-1");
  });

  it("overrides a revision to APPROVE on an unusable-image session to ESCALATE (AC-22)", () => {
    const revised = decision({ decision: "APPROVE" });
    const result = applyGuard(revised, ctx({ imageUsable: false }));
    expect(result.decision).toBe("ESCALATE");
  });

  it("passes a revision to MORE_INFO through when in window and image usable", () => {
    const revised = decision({ decision: "MORE_INFO", missingInfo: "Data wystąpienia usterki." });
    const result = applyGuard(revised, ctx());
    expect(result.decision).toBe("MORE_INFO");
    expect(result.messageMarkdown).toMatch(/ostateczną decyzję potwierdzi/);
  });
});

// --- resolveGuardContext: surfaces PolicyConfigError from loadPolicy --------

describe("resolveGuardContext — propagates policy configuration errors", () => {
  beforeEach(() => {
    // Clear the module cache so the dynamic import inside each test picks
    // up the per-test vi.doMock for `@/lib/policies`.
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/policies");
    vi.resetModules();
  });

  it("re-throws PolicyConfigError when loadPolicy fails (no silent model-only fallback, ADR-001 section 3)", async () => {
    vi.doMock("@/lib/policies", () => ({
      loadPolicy: vi.fn(() => {
        throw new PolicyConfigError("missing frontmatter", "/path/to/policy.md");
      }),
      PolicyConfigError,
    }));
    const { resolveGuardContext: fresh } = await import("./guard");
    expect(() =>
      fresh("return", { today: "2026-07-16", purchaseDate: "2026-07-01", imageUsable: true })
    ).toThrow(PolicyConfigError);
  });

  it("builds a GuardContext from a successfully loaded policy", async () => {
    vi.doMock("@/lib/policies", () => ({
      loadPolicy: vi.fn(() => ({
        windowDays: 14,
        windowRuleId: "R-1",
        prose: "# Return Policy",
      })),
      PolicyConfigError,
    }));
    const { resolveGuardContext: fresh } = await import("./guard");
    const built = fresh("return", { today: "2026-07-16", purchaseDate: "2026-07-10", imageUsable: true });
    expect(built).toEqual({
      purchaseDate: "2026-07-10",
      today: "2026-07-16",
      windowDays: 14,
      windowRuleId: "R-1",
      imageUsable: true,
    });
  });
});
