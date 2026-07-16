/**
 * Unit tests for the reviewer case-detail view (PRD §9.3, AC-42; ADR-004
 * §3/§6).
 *
 * Given a full `CaseDetail`-shaped fixture, the view renders: form data,
 * the stored image(s) via the protected image route, the raw image
 * analysis (including the `conclusive` flag), the full decision history
 * (reusing `DecisionBlock` — ADR-004 §6 component diagram), and the
 * read-only chat transcript reusing the same message-part rendering as the
 * live chat screen, so a `tool-submitDecision` part renders as a
 * `DecisionBlock` there too. Per AC-42/TAC-004-04 the view has zero
 * interactive elements besides the single back-navigation link.
 */

import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import type { UIMessage } from "ai";

import { CaseDetailView } from "@/components/reviewer/CaseDetailView";
import { pl } from "@/lib/copy/pl";
import type { CaseDetail } from "@/lib/db/cases";

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function decisionMessageParts(): UIMessage["parts"] {
  return [
    {
      type: "tool-submitDecision",
      toolCallId: "tool-1",
      state: "output-available",
      input: {},
      output: {
        status: "approved",
        justification: "Zdjęcie jest wyraźne.",
        nextSteps: ["Zapakuj produkt"],
        isRevision: false,
      },
    },
  ] as unknown as UIMessage["parts"];
}

function makeCaseDetail(): CaseDetail {
  return {
    id: "case-42",
    caseNumber: "HSC-20260715-0009",
    requestType: "reklamacja",
    category: "Laptop",
    productName: "Dell XPS 13",
    purchaseDate: "2025-11-01",
    description: "Pęknięta obudowa przy normalnym użytkowaniu.",
    needsReview: true,
    createdAt: "2026-07-15T10:00:00.000Z",
    updatedAt: "2026-07-15T10:05:00.000Z",
    images: [
      {
        id: "img-1",
        caseId: "case-42",
        filePath: "uploads/case-42/1.jpg",
        source: "form",
        originalFilename: "zdjecie.jpg",
        mimeType: "image/jpeg",
        createdAt: "2026-07-15T10:00:00.000Z",
      },
    ],
    analyses: [
      {
        id: "an-1",
        caseId: "case-42",
        caseImageId: "img-1",
        conclusive: true,
        analysis: { damaged: true, damageType: "pęknięcie obudowy" },
        createdAt: "2026-07-15T10:01:00.000Z",
      },
    ],
    decisions: [
      {
        id: "dec-1",
        caseId: "case-42",
        status: "needs_human_review",
        justification: "Sprzeczne informacje.",
        nextSteps: [],
        isRevision: false,
        createdAt: "2026-07-15T10:02:00.000Z",
      },
      {
        id: "dec-2",
        caseId: "case-42",
        status: "rejected",
        justification: "Uszkodzenie mechaniczne poza gwarancją.",
        nextSteps: ["Skontaktuj się z serwisem"],
        isRevision: true,
        createdAt: "2026-07-15T10:03:00.000Z",
      },
    ],
    messages: [
      {
        id: "msg-1",
        caseId: "case-42",
        role: "assistant",
        parts: [{ type: "text", text: "Cześć! Twoje zgłoszenie zostało przeanalizowane." }],
        createdAt: "2026-07-15T10:00:30.000Z",
      },
      {
        id: "msg-2",
        caseId: "case-42",
        role: "user",
        parts: [{ type: "text", text: "Kiedy dostanę odpowiedź?" }],
        createdAt: "2026-07-15T10:04:00.000Z",
      },
      {
        id: "msg-3",
        caseId: "case-42",
        role: "assistant",
        parts: decisionMessageParts(),
        createdAt: "2026-07-15T10:05:00.000Z",
      },
    ],
  };
}

describe("CaseDetailView", () => {
  it("renders form data", () => {
    render(<CaseDetailView caseDetail={makeCaseDetail()} />);

    expect(screen.getByText(pl.form.fields.requestType.options.reklamacja)).toBeInTheDocument();
    expect(screen.getByText("Laptop")).toBeInTheDocument();
    expect(screen.getByText("Dell XPS 13")).toBeInTheDocument();
    expect(screen.getByText("Pęknięta obudowa przy normalnym użytkowaniu.")).toBeInTheDocument();
  });

  it("renders the stored image via the protected image route", () => {
    render(<CaseDetailView caseDetail={makeCaseDetail()} />);
    const image = screen.getByRole("img", { name: "zdjecie.jpg" });
    expect(image).toHaveAttribute("src", "/api/images/uploads/case-42/1.jpg");
  });

  it("renders the raw image analysis including the conclusive flag", () => {
    render(<CaseDetailView caseDetail={makeCaseDetail()} />);
    const analysisBlock = screen.getByTestId("image-analysis");
    expect(analysisBlock.textContent).toMatch(/"conclusive":\s*true/);
    expect(analysisBlock.textContent).toContain("pęknięcie obudowy");
  });

  it("renders the full decision history via DecisionBlock (multiple decisions)", () => {
    render(<CaseDetailView caseDetail={makeCaseDetail()} />);
    expect(screen.getByText(pl.chat.decisionLabels.doWeryfikacji)).toBeInTheDocument();
    expect(screen.getByText(pl.chat.decisionLabels.odrzucone)).toBeInTheDocument();
    expect(screen.getByText(pl.chat.updatedDecisionLabel)).toBeInTheDocument();
  });

  it("renders the transcript, with a tool-submitDecision part rendering a DecisionBlock there too", () => {
    render(<CaseDetailView caseDetail={makeCaseDetail()} />);
    expect(screen.getByText("Kiedy dostanę odpowiedź?")).toBeInTheDocument();
    // "approved" only ever appears via the transcript's tool-submitDecision part
    // (decisions[] only contains needs_human_review/rejected in this fixture).
    expect(screen.getByText(pl.chat.decisionLabels.zaakceptowane)).toBeInTheDocument();
  });

  it("has no interactive elements besides the back-navigation link (AC-42/TAC-004-04)", () => {
    render(<CaseDetailView caseDetail={makeCaseDetail()} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(document.querySelector("button")).toBeNull();
    expect(document.querySelector("input")).toBeNull();
    expect(document.querySelector("form")).toBeNull();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/reviewer");
    expect(links[0].tagName).toBe("A");
  });
});
