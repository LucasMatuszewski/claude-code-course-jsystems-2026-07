"use client";

/**
 * Decision block (PRD §9.2, AC-13/AC-20/AC-23; ADR-004 §3).
 *
 * Renders a `submitDecision` tool-call OUTPUT as a distinct, status-coloured
 * card: the Polish status label, justification, numbered next steps, an
 * escalation notice for human review, and the mandatory automated-decision
 * disclaimer in smaller text. A revision additionally shows the
 * "Zaktualizowana decyzja" label.
 *
 * It reads from the tool part's `.output` (DB-computed `isRevision` + the
 * AC-14 escalation override) — never `.input` (the raw model proposal). All
 * text fields except `status` are treated as optional so a partially-shaped
 * output renders gracefully (empty sections are skipped, never crashes).
 *
 * Status edge colours use theme tokens (no raw hex): approved → primary
 * purple, rejected → destructive magenta (#E6144B token), review →
 * muted-foreground grey (#707070 token).
 */

import { cn } from "@/lib/utils";
import { pl } from "@/lib/copy/pl";

export type DecisionStatus = "approved" | "rejected" | "needs_human_review";

export interface DecisionOutput {
  status: DecisionStatus;
  justification?: string;
  nextSteps?: string[];
  isRevision?: boolean;
}

const STATUS_LABEL: Record<DecisionStatus, string> = {
  approved: pl.chat.decisionLabels.zaakceptowane,
  rejected: pl.chat.decisionLabels.odrzucone,
  needs_human_review: pl.chat.decisionLabels.doWeryfikacji,
};

const STATUS_EDGE: Record<DecisionStatus, string> = {
  approved: "border-l-primary",
  rejected: "border-l-destructive",
  needs_human_review: "border-l-muted-foreground",
};

export function DecisionBlock({ output }: { output: DecisionOutput }) {
  const steps = output.nextSteps ?? [];

  return (
    <div
      data-testid="decision-block"
      className={cn(
        "rounded-[14px] border border-l-4 bg-background p-4 shadow-sm",
        STATUS_EDGE[output.status],
      )}
    >
      {output.isRevision && (
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">
          {pl.chat.updatedDecisionLabel}
        </p>
      )}

      <p className="text-xs font-medium text-muted-foreground">
        {pl.chat.greeting.decisionHeading}
      </p>
      <p className="text-base font-semibold">{STATUS_LABEL[output.status]}</p>

      {output.justification && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground">
            {pl.chat.greeting.justificationHeading}
          </p>
          <p className="mt-0.5 text-sm">{output.justification}</p>
        </div>
      )}

      {steps.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground">
            {pl.chat.greeting.nextStepsHeading}
          </p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
            {steps.map((step, index) => (
              <li key={`${index}-${step}`}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {output.status === "needs_human_review" && (
        <p className="mt-3 text-sm">{pl.chat.escalationNotice}</p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">{pl.chat.disclaimer}</p>
    </div>
  );
}
