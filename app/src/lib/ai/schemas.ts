/**
 * Zod schemas for the two-stage AI pipeline (ADR-002 §3/§4). Used both as
 * the structured-output contract passed to `Output.object({ schema })` and
 * as the typed shape persisted via `lib/db/image-analyses.ts` /
 * `lib/db/decisions.ts` (those modules treat the value as opaque JSON —
 * this module owns the shape).
 */

import { z } from "zod";

/**
 * Stage 1 (vision model) output. `damaged`/`usageSigns`/`damageType`/
 * `plausibleCause` are interpreted differently per request type (ADR-002
 * §4): for complaints, `damaged`+`damageType`+`plausibleCause` matter; for
 * returns, `usageSigns` matters and `damaged` means "shows damage that would
 * block resale". `customerFacingIssue` is populated only when `conclusive`
 * is false (what's wrong with the photo, shown to the customer verbatim);
 * `internalNotes` is the full internal reasoning, never shown verbatim to
 * the customer, stored for the reviewer view.
 */
export const ImageAnalysisSchema = z.object({
  conclusive: z.boolean(),
  damaged: z.boolean(),
  damageType: z.string().nullable(),
  plausibleCause: z.string().nullable(),
  usageSigns: z.boolean().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  customerFacingIssue: z.string().nullable(),
  internalNotes: z.string(),
});

export type ImageAnalysis = z.infer<typeof ImageAnalysisSchema>;

/**
 * Stage 2/3 (decision agent) output, produced either directly via
 * `Output.object` (first decision) or via the `submitDecision` tool
 * (ongoing chat revisions) — same shape in both cases (ADR-002 §3).
 */
export const DecisionSchema = z.object({
  status: z.enum(["approved", "rejected", "needs_human_review"]),
  justification: z.string(),
  nextSteps: z.array(z.string()),
  isRevision: z.boolean(),
  requiresBetterPhoto: z.boolean(),
});

export type Decision = z.infer<typeof DecisionSchema>;
