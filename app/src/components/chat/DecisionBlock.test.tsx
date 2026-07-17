import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DecisionBlock, isDecisionDataPart, type DecisionDataPart } from "./DecisionBlock";
import { pl } from "@/lib/i18n/pl";
import { DISCLAIMER_PL } from "@/lib/ai/prompts";

/**
 * DecisionBlock (PRD §9.2 "First message"; AC-17; ADR-002 §3 + design-
 * guidelines §2/§6 badge mapping).
 *
 * The AI-generated `messageMarkdown` already contains the full body
 * (greeting, justification, numbered next steps) with the mandatory
 * disclaimer appended as trailing text by the guard (`ensureDisclaimer` in
 * `lib/ai/guard.ts`). DecisionBlock's job is purely presentational: render
 * the category badge (visual distinction, AC-17), the body as markdown, and
 * split the trailing disclaimer sentence into its own small-print element.
 */
describe("DecisionBlock", () => {
  const body = [
    "Dzień dobry,",
    "",
    "Państwa zgłoszenie zostało rozpatrzone pozytywnie.",
    "",
    "Kolejne kroki:",
    "1. Zapakuj sprzęt w oryginalne opakowanie.",
    "2. Zaczekaj na kuriera.",
  ].join("\n");
  const messageMarkdown = `${body}\n\n${DISCLAIMER_PL}`;

  it.each([
    ["APPROVE", pl.chat.decisionBadge.APPROVE, "badge-approve"],
    ["REJECT", pl.chat.decisionBadge.REJECT, "badge-reject"],
    ["MORE_INFO", pl.chat.decisionBadge.MORE_INFO, "badge-more-info"],
    ["ESCALATE", pl.chat.decisionBadge.ESCALATE, "badge-escalate"],
  ] as const)(
    "renders the %s badge with the correct Polish label and color token",
    (category, label, colorClass) => {
      render(<DecisionBlock category={category} messageMarkdown={messageMarkdown} />);
      const badge = screen.getByTestId("decision-badge");
      expect(badge).toHaveTextContent(label);
      expect(badge.className).toContain(colorClass);
    },
  );

  it("renders the numbered next steps as a visible ordered list (AC-17)", () => {
    render(<DecisionBlock category="APPROVE" messageMarkdown={messageMarkdown} />);
    const block = screen.getByTestId("decision-block");
    const list = within(block).getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Zapakuj sprzęt");
    expect(items[1]).toHaveTextContent("Zaczekaj na kuriera");
  });

  it("renders the greeting and justification body text", () => {
    render(<DecisionBlock category="APPROVE" messageMarkdown={messageMarkdown} />);
    expect(screen.getByText(/Dzień dobry/)).toBeInTheDocument();
    expect(
      screen.getByText(/zgłoszenie zostało rozpatrzone pozytywnie/),
    ).toBeInTheDocument();
  });

  it("splits the trailing disclaimer into its own small-print element (AC-17 structure)", () => {
    render(<DecisionBlock category="APPROVE" messageMarkdown={messageMarkdown} />);
    const disclaimer = screen.getByTestId("decision-disclaimer");
    expect(disclaimer).toHaveTextContent(DISCLAIMER_PL);
    // The disclaimer must not also appear duplicated inside the markdown body.
    expect(screen.getAllByText(new RegExp(DISCLAIMER_PL.slice(0, 20)))).toHaveLength(1);
  });

  it("renders the disclaimer element last (visible order: greeting → decision → justification → steps → disclaimer)", () => {
    render(<DecisionBlock category="APPROVE" messageMarkdown={messageMarkdown} />);
    const block = screen.getByTestId("decision-block");
    const disclaimer = screen.getByTestId("decision-disclaimer");
    // compareDocumentPosition: DOCUMENT_POSITION_FOLLOWING (4) means disclaimer
    // comes after everything else appended before it in the block.
    const children = Array.from(block.children);
    expect(children[children.length - 1]).toBe(disclaimer);
  });

  it("renders gracefully (no crash, no disclaimer element) when the text has no trailing disclaimer", () => {
    render(<DecisionBlock category="ESCALATE" messageMarkdown="Treść bez klauzuli." />);
    expect(screen.getByText("Treść bez klauzuli.")).toBeInTheDocument();
    expect(screen.queryByTestId("decision-disclaimer")).toBeNull();
  });
});

describe("isDecisionDataPart", () => {
  it("identifies a data-decision part", () => {
    const part: DecisionDataPart = {
      type: "data-decision",
      data: { category: "APPROVE", messageMarkdown: "x" },
    };
    expect(isDecisionDataPart(part)).toBe(true);
  });

  it("rejects other part types", () => {
    expect(isDecisionDataPart({ type: "text", text: "hi" })).toBe(false);
    expect(isDecisionDataPart({ type: "data-other", data: {} })).toBe(false);
  });
});
