/**
 * Unit tests for the DecisionBlock (PRD §9.2, AC-13/AC-20/AC-23).
 *
 * The block renders a `submitDecision` tool-call output as a distinct,
 * status-coloured card: the Polish status label, justification, numbered
 * next steps, the mandatory disclaimer, and — for revisions — the
 * "Zaktualizowana decyzja" label. Missing optional fields must render
 * gracefully (no crash, empty sections skipped).
 */

import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";

import { DecisionBlock } from "@/components/chat/DecisionBlock";
import { pl } from "@/lib/copy/pl";

afterEach(() => {
  cleanup();
});

describe("DecisionBlock", () => {
  it("renders an approved decision: status label, justification, numbered steps, disclaimer", () => {
    render(
      <DecisionBlock
        output={{
          status: "approved",
          justification: "Produkt jest w idealnym stanie.",
          nextSteps: ["Zapakuj produkt", "Wyślij paczkę"],
          isRevision: false,
        }}
      />,
    );

    expect(screen.getByText(pl.chat.decisionLabels.zaakceptowane)).toBeInTheDocument();
    expect(screen.getByText("Produkt jest w idealnym stanie.")).toBeInTheDocument();

    const firstStep = screen.getByText("Zapakuj produkt");
    expect(firstStep).toBeInTheDocument();
    expect(firstStep.closest("ol")).not.toBeNull();
    expect(screen.getByText("Wyślij paczkę")).toBeInTheDocument();

    expect(screen.getByText(pl.chat.disclaimer)).toBeInTheDocument();
    // Not a revision -> no updated-decision label.
    expect(screen.queryByText(pl.chat.updatedDecisionLabel)).not.toBeInTheDocument();
  });

  it("renders the rejected status label", () => {
    render(
      <DecisionBlock
        output={{ status: "rejected", justification: "Widoczne ślady użytkowania.", nextSteps: [], isRevision: false }}
      />,
    );
    expect(screen.getByText(pl.chat.decisionLabels.odrzucone)).toBeInTheDocument();
  });

  it("adds the 'Zaktualizowana decyzja' label when isRevision is true (AC-23)", () => {
    render(
      <DecisionBlock
        output={{ status: "approved", justification: "Nowe informacje.", nextSteps: ["Krok"], isRevision: true }}
      />,
    );
    expect(screen.getByText(pl.chat.updatedDecisionLabel)).toBeInTheDocument();
    expect(screen.getByText(pl.chat.decisionLabels.zaakceptowane)).toBeInTheDocument();
  });

  it("shows the escalation notice for needs_human_review", () => {
    render(
      <DecisionBlock
        output={{ status: "needs_human_review", justification: "Nie można ocenić.", nextSteps: [], isRevision: false }}
      />,
    );
    expect(screen.getByText(pl.chat.decisionLabels.doWeryfikacji)).toBeInTheDocument();
    expect(screen.getByText(pl.chat.escalationNotice)).toBeInTheDocument();
  });

  it("renders gracefully when optional fields are missing (no crash, empty sections skipped)", () => {
    render(<DecisionBlock output={{ status: "approved" }} />);

    // Status label + disclaimer still render.
    expect(screen.getByText(pl.chat.decisionLabels.zaakceptowane)).toBeInTheDocument();
    expect(screen.getByText(pl.chat.disclaimer)).toBeInTheDocument();
    // No steps list is rendered when nextSteps is absent/empty.
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
