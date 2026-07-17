import { z } from "zod";

/**
 * Structured-output schemas for the two LLM stages (ADR-001 section 4).
 *
 * Both schemas are consumed by the AI SDK's structured-output mode in T2.2
 * (vision + decision). They are intentionally permissive about *which*
 * nullable fields are populated per request type (e.g. `plausibleCauses` is
 * only meaningful for complaints, `resellableAssessment` only for returns):
 * the per-type *instruction text* in `prompts.ts` tells the model which
 * fields to fill; the schema enforces only the shape, so a single schema can
 * serve both request types (ADR-001 D1-03).
 */

// --- Enums shared across stages --------------------------------------------

/**
 * Confidence the vision model has in its own reading of the photo. Drives
 * nothing structurally today (MVP) but is persisted for staff review
 * (AC-26) and as a future guard signal.
 */
export const confidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof confidenceSchema>;

/**
 * The four decision categories the agent may recommend (AC-12, ADR-000
 * section 5). Stored as UPPERCASE stable keys; the DB layer mirrors the
 * same values in `db/schema.ts` `DECISION_CATEGORIES` (not imported here to
 * keep the AI module free of persistence coupling).
 */
export const decisionCategorySchema = z.enum([
  "APPROVE",
  "REJECT",
  "MORE_INFO",
  "ESCALATE",
]);
export type DecisionCategory = z.infer<typeof decisionCategorySchema>;

// --- Stage 1: vision output ------------------------------------------------

/**
 * Schema-validated output of the vision stage (ADR-001 section 4
 * "ImageAnalysis"). Same schema for both request types; the per-type
 * instruction in `prompts.ts` selects which nullable fields the model
 * should populate.
 *
 * `imageUsable` is the load-bearing field for the deterministic guard
 * (AC-10): when false, downstream decisions are forced to ESCALATE.
 */
export const imageAnalysisSchema = z.object({
  /** Sharp enough, shows equipment, matches declared category/model (AC-10). */
  imageUsable: z.boolean(),
  /** Why the photo is unusable (blurry / wrong object / not visible / mismatch). Null when usable. */
  unusableReason: z.string().nullable(),
  /** Item plausibly is the declared category/model. */
  matchesDeclaredProduct: z.boolean(),
  /** Any visible damage on the equipment. */
  damageVisible: z.boolean(),
  /** Type and location of visible damage. Null when no damage is visible. */
  damageDescription: z.string().nullable(),
  /** Complaint runs: manufacturing-defect vs. user-caused assessment. Null on returns. */
  plausibleCauses: z.string().nullable(),
  /** Return runs: visible signs of usage. Null on complaints. */
  usageSigns: z.string().nullable(),
  /** Return runs only: appears complete and resellable as new. Null on complaints. */
  resellableAssessment: z.string().nullable(),
  confidence: confidenceSchema,
});
export type ImageAnalysis = z.infer<typeof imageAnalysisSchema>;

// --- Stage 2: decision output ----------------------------------------------

/**
 * Schema-validated output of the decision stage (ADR-001 section 4
 * "DecisionResult"). The guard in `guard.ts` rewrites this object in place
 * to enforce hard rules (window, usability, disclaimer) before it is
 * persisted or shown to the customer.
 */
export const decisionResultSchema = z.object({
  /** AC-12: exactly one of the four categories. */
  decision: decisionCategorySchema,
  /**
   * Free-text justification that must reference concrete inputs (AC-13);
   * for REJECT must cite a policy rule ID (AC-14). The guard does not edit
   * this text except to ensure the disclaimer appears in `messageMarkdown`.
   */
  justification: z.string().min(1),
  /** Policy rule identifiers used (e.g. "R-4", "C-6"). The guard appends `windowRuleId` when the window rule fires. */
  citedRuleIds: z.array(z.string()),
  /** Required when decision is MORE_INFO (what exactly is missing). Null otherwise. */
  missingInfo: z.string().nullable(),
  /** The complete first chat message in Polish (greeting, decision, justification, next steps, disclaimer — AC-17). */
  messageMarkdown: z.string().min(1),
});
export type DecisionResult = z.infer<typeof decisionResultSchema>;
