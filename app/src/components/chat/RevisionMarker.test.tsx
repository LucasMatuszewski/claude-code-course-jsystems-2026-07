import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  RevisionMarker,
  isReviseDecisionOutputPart,
  type ReviseDecisionToolPart,
} from "./RevisionMarker";
import { pl } from "@/lib/i18n/pl";

/**
 * RevisionMarker (PRD §9.2 "Decision-revision messages"; AC-21; ADR-002 §3 +
 * ADR-001 D1-04).
 *
 * Shows the old → new decision category. The *reason* for the change is
 * delivered as ordinary streamed text by the model in the same turn (D1-04:
 * "the model ... writes the visible old → new explanation in its streamed
 * text") — `lib/i18n/pl.ts` `decisionChanged` has no reason field, only
 * `fromLabel`/`toLabel`/`arrow`, confirming this split.
 *
 * Tool-part shape: T2.3 (`revise_decision`, `@/lib/ai/chat`) is now merged.
 * Its `reviseDecisionOutputSchema` output is `{ accepted, recordedDecision,
 * previousDecision (nullable), overrideReason, citedRuleIds }` — no
 * `justification`/`guardOverride` fields (those live only in the DB
 * `Decision` row, not the tool output). `RevisionMarker` only needs the two
 * category fields; `MessageRow` is responsible for not rendering it when
 * `previousDecision` is `null` (nothing to show an "old" badge for).
 */
describe("RevisionMarker", () => {
  it("renders the previous and new decision badges with Polish labels", () => {
    render(<RevisionMarker previousDecision="APPROVE" newDecision="REJECT" />);
    expect(screen.getByText(pl.chat.decisionChanged.badgeLabel)).toBeInTheDocument();
    expect(screen.getByText(pl.chat.decisionChanged.fromLabel)).toBeInTheDocument();
    expect(screen.getByText(pl.chat.decisionChanged.toLabel)).toBeInTheDocument();
    expect(screen.getByText(pl.chat.decisionBadge.APPROVE)).toBeInTheDocument();
    expect(screen.getByText(pl.chat.decisionBadge.REJECT)).toBeInTheDocument();
  });

  it("renders the arrow between the two badges", () => {
    render(<RevisionMarker previousDecision="MORE_INFO" newDecision="ESCALATE" />);
    expect(screen.getByText(pl.chat.decisionChanged.arrow)).toBeInTheDocument();
  });

  it.each([
    ["APPROVE", "REJECT"],
    ["REJECT", "ESCALATE"],
    ["MORE_INFO", "APPROVE"],
    ["ESCALATE", "MORE_INFO"],
  ] as const)("renders a %s → %s marker without crashing", (from, to) => {
    expect(() =>
      render(<RevisionMarker previousDecision={from} newDecision={to} />),
    ).not.toThrow();
  });
});

describe("isReviseDecisionOutputPart", () => {
  const outputPart: ReviseDecisionToolPart = {
    type: "tool-revise_decision",
    toolCallId: "call-1",
    state: "output-available",
    input: { newDecision: "REJECT", reason: "Brak paragonu", citedRuleIds: ["R-2"] },
    output: {
      accepted: true,
      recordedDecision: "REJECT",
      previousDecision: "APPROVE",
      overrideReason: null,
      citedRuleIds: ["R-2"],
    },
  };

  it("accepts an output-available revise_decision tool part", () => {
    expect(isReviseDecisionOutputPart(outputPart)).toBe(true);
  });

  it("rejects the same tool while input is still streaming (no output yet)", () => {
    expect(
      isReviseDecisionOutputPart({
        type: "tool-revise_decision",
        toolCallId: "call-1",
        state: "input-streaming",
      }),
    ).toBe(false);
  });

  it("rejects an output-available part whose previousDecision is null (guard-overridden first-ever revision with nothing to compare)", () => {
    expect(
      isReviseDecisionOutputPart({
        ...outputPart,
        output: { ...outputPart.output, previousDecision: null },
      }),
    ).toBe(false);
  });

  it("rejects unrelated part types", () => {
    expect(isReviseDecisionOutputPart({ type: "text", text: "hi" })).toBe(false);
    expect(
      isReviseDecisionOutputPart({
        type: "tool-other_tool",
        toolCallId: "call-2",
        state: "output-available",
        output: {},
      }),
    ).toBe(false);
  });
});
