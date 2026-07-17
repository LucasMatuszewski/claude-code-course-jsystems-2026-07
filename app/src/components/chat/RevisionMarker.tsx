import type { DecisionCategory } from "@/lib/ai/types";
import type {
  REVISE_DECISION_TOOL_NAME as ReviseDecisionToolName,
  ReviseDecisionOutput,
} from "@/lib/ai/chat";
import { pl } from "@/lib/i18n/pl";

import { CategoryBadge } from "./DecisionBlock";

export type { ReviseDecisionOutput };

const REVISE_DECISION_TOOL_NAME =
  "revise_decision" satisfies typeof ReviseDecisionToolName;

const DECISION_CATEGORIES = [
  "APPROVE",
  "REJECT",
  "MORE_INFO",
  "ESCALATE",
] as const satisfies readonly DecisionCategory[];

type ReviseDecisionToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error"
  | "approval-requested"
  | "approval-responded"
  | "output-denied";

export interface ReviseDecisionToolPart {
  type: `tool-${typeof REVISE_DECISION_TOOL_NAME}`;
  toolCallId: string;
  state: ReviseDecisionToolState;
  input?: unknown;
  output?: ReviseDecisionOutput;
}

type ReviseDecisionOutputPart = ReviseDecisionToolPart & {
  state: "output-available";
  output: ReviseDecisionOutput & { previousDecision: DecisionCategory };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDecisionCategory(value: unknown): value is DecisionCategory {
  return (
    typeof value === "string" &&
    DECISION_CATEGORIES.includes(value as DecisionCategory)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isOverrideReason(
  value: unknown,
): value is ReviseDecisionOutput["overrideReason"] {
  return (
    value === null ||
    value === "out_of_window" ||
    value === "image_unusable"
  );
}

function isReviseDecisionOutput(
  value: unknown,
): value is ReviseDecisionOutput {
  return (
    isRecord(value) &&
    typeof value.accepted === "boolean" &&
    isDecisionCategory(value.recordedDecision) &&
    (value.previousDecision === null ||
      isDecisionCategory(value.previousDecision)) &&
    isOverrideReason(value.overrideReason) &&
    isStringArray(value.citedRuleIds)
  );
}

export function isReviseDecisionOutputPart(
  part: unknown,
): part is ReviseDecisionOutputPart {
  if (!isRecord(part)) {
    return false;
  }

  if (part.type !== `tool-${REVISE_DECISION_TOOL_NAME}`) {
    return false;
  }

  if (part.state !== "output-available") {
    return false;
  }

  return (
    isReviseDecisionOutput(part.output) &&
    part.output.previousDecision !== null
  );
}

export interface RevisionMarkerProps {
  previousDecision: DecisionCategory;
  newDecision: DecisionCategory;
}

export function RevisionMarker({
  previousDecision,
  newDecision,
}: RevisionMarkerProps) {
  return (
    <div
      data-testid="revision-marker"
      className="border-border-strong/40 bg-background-subtle flex flex-col gap-2 rounded-[var(--radius-play-md)] border p-md"
    >
      <span className="text-text-secondary text-xs font-semibold">
        {pl.chat.decisionChanged.badgeLabel}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-text-secondary text-xs">
          {pl.chat.decisionChanged.fromLabel}
        </span>
        <CategoryBadge category={previousDecision} />
        <span className="text-text-secondary text-xs">
          {pl.chat.decisionChanged.arrow}
        </span>
        <span className="text-text-secondary text-xs">
          {pl.chat.decisionChanged.toLabel}
        </span>
        <CategoryBadge category={newDecision} />
      </div>
    </div>
  );
}
