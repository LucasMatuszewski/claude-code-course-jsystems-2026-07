/**
 * Unit tests for the reviewer escalated-cases table (PRD §9.3, AC-41).
 *
 * Renders a plain, read-only table: case number (linked to the detail
 * page), timestamp, request type, category, and product name/model.
 * Newest-first ordering is guaranteed by `listEscalatedCases` (ADR-003) and
 * is not re-tested here — this component renders rows in the order it is
 * given. Empty list renders the Polish "Brak zgłoszeń do weryfikacji" empty
 * state (PRD §9.3) instead of an empty table.
 */

import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";

import { EscalatedCasesTable } from "@/components/reviewer/EscalatedCasesTable";
import { pl } from "@/lib/copy/pl";
import type { CaseSummary } from "@/lib/db/cases";

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  // next/link prefetch relies on IntersectionObserver, unavailable in jsdom.
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function makeCase(overrides: Partial<CaseSummary> = {}): CaseSummary {
  return {
    id: "case-1",
    caseNumber: "HSC-20260715-0001",
    requestType: "reklamacja",
    category: "Laptop",
    productName: "Dell XPS 13",
    purchaseDate: "2025-11-01",
    description: "Pęknięta obudowa",
    needsReview: true,
    createdAt: "2026-07-15T10:30:00.000Z",
    updatedAt: "2026-07-15T10:30:00.000Z",
    ...overrides,
  };
}

describe("EscalatedCasesTable", () => {
  it("renders a row with all AC-41 columns for a non-empty list", () => {
    render(<EscalatedCasesTable cases={[makeCase()]} />);

    expect(screen.getByText("HSC-20260715-0001")).toBeInTheDocument();
    expect(screen.getByText(pl.form.fields.requestType.options.reklamacja)).toBeInTheDocument();
    expect(screen.getByText("Laptop")).toBeInTheDocument();
    expect(screen.getByText("Dell XPS 13")).toBeInTheDocument();
    // Timestamp column renders a UTC-based, TZ-independent formatted date.
    expect(screen.getByText(/15\.07\.2026/)).toBeInTheDocument();
  });

  it("links the case number to the detail page", () => {
    render(<EscalatedCasesTable cases={[makeCase({ id: "abc-123" })]} />);
    const link = screen.getByRole("link", { name: "HSC-20260715-0001" });
    expect(link).toHaveAttribute("href", "/reviewer/abc-123");
  });

  it("renders rows in the given order (newest-first is the DB layer's job)", () => {
    render(
      <EscalatedCasesTable
        cases={[
          makeCase({ id: "newer", caseNumber: "HSC-20260716-0001" }),
          makeCase({ id: "older", caseNumber: "HSC-20260715-0001" }),
        ]}
      />,
    );
    const rows = screen.getAllByRole("row");
    // rows[0] is the header row.
    expect(rows[1]).toHaveTextContent("HSC-20260716-0001");
    expect(rows[2]).toHaveTextContent("HSC-20260715-0001");
  });

  it("shows the empty state when there are no escalated cases", () => {
    render(<EscalatedCasesTable cases={[]} />);
    expect(screen.getByText(pl.reviewer.emptyState)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
