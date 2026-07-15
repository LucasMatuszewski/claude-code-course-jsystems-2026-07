/**
 * Shared types for the policy loader (`docs/policies/*.md`).
 *
 * See ADR-001 §3 "Policy frontmatter contract" and ADR-000 D6: hard policy
 * rules (e.g. return/complaint window length) are sourced from a small
 * machine-readable YAML frontmatter block on each policy document, while the
 * prose below it remains the LLM's reasoning source.
 */

/** The two request types the app supports; one policy document per type. */
export type PolicyRequestType = "return" | "complaint";

/**
 * A policy document split into its machine-readable frontmatter values and
 * its prose body (injected verbatim into the decision agent's prompt).
 */
export interface PolicyDocument {
  /** Hard rule: number of days the return/complaint window is open. */
  windowDays: number;
  /** Rule id cited by the guard in generated ESCALATE/REJECT justifications (e.g. "R-1", "C-1"). */
  windowRuleId: string;
  /** Prose content of the policy document, with the frontmatter block stripped. */
  prose: string;
}

/**
 * Thrown when a policy file cannot be read, or its frontmatter is missing or
 * fails validation. This is a fail-fast configuration error (ADR-001 §3):
 * a broken policy document must never fall back to a silent, model-only mode.
 */
export class PolicyConfigError extends Error {
  /** Absolute path of the policy file that failed to load. */
  public readonly filePath: string;

  constructor(message: string, filePath: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PolicyConfigError";
    this.filePath = filePath;
  }
}
