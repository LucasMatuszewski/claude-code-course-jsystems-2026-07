import type { RequestType } from "@/lib/validation";
import { loadPolicy, PolicyConfigError } from "@/lib/policies";
import { DISCLAIMER_PL } from "./prompts";
import type { DecisionCategory, DecisionResult } from "./types";

/**
 * Deterministic hard-rule guard for the AI layer (ADR-001 section 3
 * "guard", section 6 D1-05 "Layered behavior control").
 *
 * Three rules, all enforced server-side and exhaustively unit-tested so
 * the prompt layer cannot break a "never" guarantee (TAC-001-01..03):
 *
 *   1. WINDOW  — purchase older than the policy's `windowDays` blocks
 *                APPROVE/MORE_INFO; only REJECT or ESCALATE are admissible;
 *                the result must cite `windowRuleId` (AC-14, AC-15, AC-22).
 *   2. USABLE  — when `imageUsable === false`, every category other than
 *                ESCALATE is rewritten to ESCALATE (AC-10, TAC-001-02).
 *   3. DISCLAIM— every decision message ends with the Polish preliminary-
 *                 decision disclaimer (AC-16, TAC-001-03), appended if
 *                 missing and never duplicated (idempotent).
 *
 * Every function here is pure: callers inject `today` instead of reading
 * the clock so the boundary tests are deterministic.
 */

// --- Inputs -----------------------------------------------------------------

/** All inputs the guard needs to evaluate the three rules for one decision. */
export interface GuardContext {
  /** ISO yyyy-mm-dd purchase date (from the form). */
  purchaseDate: string;
  /** ISO yyyy-mm-dd "today" — injected, never `new Date()`, for testability. */
  today: string;
  /** Policy frontmatter: how many days the window is open. */
  windowDays: number;
  /** Policy frontmatter: rule id cited when the window guard fires. */
  windowRuleId: string;
  /** From the stored ImageAnalysis (AC-10). */
  imageUsable: boolean;
}

// --- Date math (calendar-day, leap-year safe) -------------------------------

/**
 * Whole calendar days between two ISO yyyy-mm-dd dates. Uses UTC midnight
 * for both endpoints so DST transitions do not shift the count by an hour,
 * and `Math.round` clears any residual leap-second drift. Returns a
 * non-negative number when `toIso >= fromIso` and a negative number
 * otherwise (callers that only care about "in window" should use
 * `isWithinWindow`, which treats future purchase dates as in-window).
 */
export function daysBetween(fromIso: string, toIso: string): number {
  const fromMs = Date.parse(`${fromIso}T00:00:00Z`);
  const toMs = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(fromMs)) {
    throw new Error(`daysBetween: invalid fromIso date: ${fromIso}`);
  }
  if (Number.isNaN(toMs)) {
    throw new Error(`daysBetween: invalid toIso date: ${toIso}`);
  }
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((toMs - fromMs) / msPerDay);
}

/**
 * True iff the purchase is still inside the policy window. Boundary is
 * inclusive: a purchase exactly `windowDays` old is ALLOWED, one day older
 * is BLOCKED (ADR-001 section 8 "Window guard").
 */
export function isWithinWindow(
  purchaseDate: string,
  today: string,
  windowDays: number,
): boolean {
  return daysBetween(purchaseDate, today) <= windowDays;
}

// --- Individual rule enforcers ----------------------------------------------

/**
 * Rewrites a model-proposed category under the usability rule. When the
 * image is unusable, only ESCALATE is admissible (AC-10, TAC-001-02
 * "ESCALATE only"). When usable, the category passes through unchanged.
 */
export function enforceUsability(
  category: DecisionCategory,
  imageUsable: boolean,
): DecisionCategory {
  if (!imageUsable) {
    return "ESCALATE";
  }
  return category;
}

/**
 * Rewrites a model-proposed category under the window rule. When the
 * purchase is out of window, APPROVE and MORE_INFO become ESCALATE (the
 * case is too stale to approve or to ask more about — AC-15, AC-22);
 * REJECT and ESCALATE are already admissible and pass through. When in
 * window, the category passes through unchanged.
 */
export function enforceWindow(
  category: DecisionCategory,
  ctx: { purchaseDate: string; today: string; windowDays: number },
): DecisionCategory {
  if (isWithinWindow(ctx.purchaseDate, ctx.today, ctx.windowDays)) {
    return category;
  }
  // Out of window: only REJECT and ESCALATE are admissible.
  if (category === "REJECT" || category === "ESCALATE") {
    return category;
  }
  return "ESCALATE";
}

// --- Disclaimer enforcement (idempotent) ------------------------------------

/**
 * Escapes a literal string for safe use inside a `RegExp`.
 */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches the disclaimer ANYWHERE in a message, tolerating the punctuation
 * the model tends to wrap it in: French guillemets («»), Polish quotes („"),
 * curly/straight double and single quotes, and any surrounding whitespace.
 * The disclaimer's own metacharacters ("—", ".") are escaped so it matches
 * literally. Global + case-sensitive: the wording is fixed by PRD section 11.
 */
const DISCLAIMER_ANYWHERE = new RegExp(
  "(?:[«„\"“”'‚‘]\\s*)?" + escapeRegExp(DISCLAIMER_PL) + "(?:\\s*[»„\"“”'‛’])?",
  "g",
);

/**
 * Guarantees a decision message ends with EXACTLY ONE copy of the Polish
 * preliminary-decision disclaimer (AC-16, TAC-001-03), as trailing
 * small-print (AC-17 "in order: ... disclaimer").
 *
 * Idempotent against near-duplicates (F-6): the model sometimes echoes the
 * disclaimer verbatim — often wrapped in guillemets or buried mid-paragraph —
 * because it appears in the (older) prompt copy. An "ends with" check missed
 * those mangled copies and appended a second clean one, so the customer saw
 * the disclaimer twice. This implementation instead removes every
 * (possibly quote-wrapped) copy found anywhere in the body, tidies the
 * whitespace the removal leaves behind, then appends the one canonical
 * `DISCLAIMER_PL`. Calling it twice yields the same single-disclaimer result.
 */
export function ensureDisclaimer(messageMarkdown: string): string {
  // Reset lastIndex: DISCLAIMER_ANYWHERE is a shared global regex.
  DISCLAIMER_ANYWHERE.lastIndex = 0;
  const withoutDisclaimer = messageMarkdown
    .replace(DISCLAIMER_ANYWHERE, "")
    // Tidy the gaps a mid-paragraph removal leaves behind.
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n");

  const trimmed = withoutDisclaimer.trimEnd();
  // Preserve a single blank line between body and disclaimer (AC-17 structure).
  const joiner = trimmed.trim().length === 0 ? "" : "\n\n";
  return `${trimmed}${joiner}${DISCLAIMER_PL}`;
}

// --- Full pipeline ----------------------------------------------------------

/**
 * Applies all three guard rules to a model-produced `DecisionResult` and
 * returns the adjusted result. Pure and immutable — the input object is
 * not modified.
 *
 * Used on BOTH call sites (ADR-001 section 8, TAC-001-01): the initial
 * decision and every chat-revision entry through the `revise_decision`
 * tool. The order of rules is intentionally: window first, then usability,
 * then disclaimer — so the most restrictive rule wins the final category
 * and the disclaimer is always applied last to the final text.
 *
 * Note: when a rule rewrites the category, the model's `justification`
 * and `messageMarkdown` text may now read inconsistently (e.g. an APPROVE
 * body forced to ESCALATE). Fixing that prose is the caller's job
 * (re-prompt or substitute a fallback); the guard only guarantees the
 * structured fields and the disclaimer.
 */
export function applyGuard(result: DecisionResult, ctx: GuardContext): DecisionResult {
  // Rule 1: window. Determine the post-window category and ensure the
  // window rule id is cited whenever the window actually fires.
  const inWindow = isWithinWindow(ctx.purchaseDate, ctx.today, ctx.windowDays);
  const afterWindow: DecisionCategory = inWindow
    ? result.decision
    : enforceWindow(result.decision, ctx);
  const citedRuleIds = inWindow || result.citedRuleIds.includes(ctx.windowRuleId)
    ? result.citedRuleIds
    : [...result.citedRuleIds, ctx.windowRuleId];

  // Rule 2: usability. Usability takes the category to ESCALATE if needed;
  // it never adds to citedRuleIds (the window rule already did, when both fire).
  const afterUsability: DecisionCategory = enforceUsability(afterWindow, ctx.imageUsable);

  // Rule 3: disclaimer.
  const messageMarkdown = ensureDisclaimer(result.messageMarkdown);

  return {
    ...result,
    decision: afterUsability,
    citedRuleIds,
    messageMarkdown,
  };
}

// --- Context builder (the only impure entry; surfaces PolicyConfigError) ----

/**
 * Builds a `GuardContext` by loading the policy frontmatter for the given
 * request type. This is the single impure entry in the AI guard module:
 * `loadPolicy` re-reads the policy file from disk on every call (no
 * module-level caching) so policy edits apply on the next request without
 * a restart (PRD section 8, ADR-001 section 3, TAC-001-06).
 *
 * Missing or invalid policy frontmatter surfaces as a typed
 * `PolicyConfigError` — the guard never falls back to a silent model-only
 * mode (ADR-001 section 3 "fail fast, not silent model-only mode").
 */
export function resolveGuardContext(
  requestType: RequestType,
  options: { today: string; purchaseDate: string; imageUsable: boolean },
): GuardContext {
  const policy = loadPolicy(requestType);
  return {
    purchaseDate: options.purchaseDate,
    today: options.today,
    windowDays: policy.windowDays,
    windowRuleId: policy.windowRuleId,
    imageUsable: options.imageUsable,
  };
}

// Re-export so callers of the guard never need a separate PolicyConfigError import.
export { PolicyConfigError };
