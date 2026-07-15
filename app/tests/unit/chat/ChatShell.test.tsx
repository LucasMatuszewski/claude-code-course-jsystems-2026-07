/**
 * Unit tests for the chat page shell (PRD §9.2; AC-20/22/24/25/30).
 *
 * Covers: hydration of the persisted first message from GET
 * /api/cases/[caseId], the case summary bar, the unknown-case error state,
 * the conditional re-upload control (derived from messages, TAC-004-02), the
 * typing indicator + disabled input while streaming, the stream-error inline
 * bubble with a retry that re-sends the last user message, and the
 * "Nowe zgłoszenie" confirm-then-navigate action.
 *
 * The hydration `fetch` is stubbed and the streaming transport is injected
 * via `createRunner` — no real network, no SSE. `next/navigation`'s
 * `useRouter` and `window.confirm` are mocked. `ResizeObserver` is stubbed
 * because the AI Elements `Conversation` (StickToBottom) requires it under
 * jsdom.
 */

import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { UIMessage } from "ai";

import { ChatShell } from "@/components/chat/ChatShell";
import type { ChatStreamRunner } from "@/components/chat/useCaseChat";
import { pl } from "@/lib/copy/pl";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const CASE_ID = "case-123";

interface HydrationOverrides {
  caseNumber?: string;
  requestType?: "zwrot" | "reklamacja";
  productName?: string;
  analyses?: { conclusive: boolean }[];
  decisions?: unknown[];
  messages?: UIMessage[];
}

function hydration(overrides: HydrationOverrides = {}) {
  return {
    id: CASE_ID,
    caseNumber: overrides.caseNumber ?? "HSC-20260715-0001",
    requestType: overrides.requestType ?? "zwrot",
    category: "Laptop",
    productName: overrides.productName ?? "Laptop XPS 13",
    purchaseDate: "2020-01-01",
    description: null,
    needsReview: false,
    createdAt: "2026-07-15T10:00:00.000Z",
    updatedAt: "2026-07-15T10:00:00.000Z",
    images: [],
    analyses: overrides.analyses ?? [],
    decisions: overrides.decisions ?? [],
    messages: overrides.messages ?? [],
  };
}

function assistantText(text: string, id = "m1"): UIMessage {
  return { id, role: "assistant", parts: [{ type: "text", text }] } as UIMessage;
}

function stubFetchOk(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => body })),
  );
}

function stubFetch404() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ error: pl.errors.caseNotFound }) })),
  );
}

/** A tool-submitDecision assistant message as produced mid-chat. */
function decisionAssistant(): UIMessage {
  return {
    id: "assist-decision",
    role: "assistant",
    parts: [
      {
        type: "tool-submitDecision",
        toolCallId: "tool-1",
        state: "output-available",
        input: {},
        output: {
          status: "approved",
          justification: "Zdjęcie jest teraz wyraźne.",
          nextSteps: ["Zapakuj produkt"],
          isRevision: false,
        },
      },
    ],
  } as unknown as UIMessage;
}

beforeEach(() => {
  pushMock.mockReset();
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ChatShell", () => {
  it("hydrates and renders the persisted first assistant message and the summary bar", async () => {
    stubFetchOk(
      hydration({
        caseNumber: "HSC-20260715-0007",
        requestType: "reklamacja",
        productName: "Telefon Pixel 9",
        decisions: [{ status: "approved" }],
        analyses: [{ conclusive: true }],
        messages: [assistantText("Cześć! Twoje zgłoszenie zostało przeanalizowane. Decyzja: Zaakceptowane.")],
      }),
    );

    render(<ChatShell caseId={CASE_ID} />);

    // First message text is hydrated.
    await screen.findByText(/Twoje zgłoszenie zostało przeanalizowane/);

    // Summary bar: case number, request type label, product name.
    expect(screen.getByText("HSC-20260715-0007")).toBeInTheDocument();
    expect(screen.getByText(pl.form.fields.requestType.options.reklamacja)).toBeInTheDocument();
    expect(screen.getByText("Telefon Pixel 9")).toBeInTheDocument();
  });

  it("shows the not-found error state for an unknown case", async () => {
    stubFetch404();
    render(<ChatShell caseId="nope" />);
    await screen.findByText(pl.errors.caseNotFound);
  });

  it("shows the re-upload control when the latest analysis is inconclusive and no decision exists", async () => {
    stubFetchOk(
      hydration({
        analyses: [{ conclusive: false }],
        decisions: [],
        messages: [assistantText("Cześć! Prześlij jedno lepsze zdjęcie sprzętu.")],
      }),
    );
    render(<ChatShell caseId={CASE_ID} />);
    // The attach affordance (aria-label = reupload prompt) is the derived signal.
    expect(await screen.findByRole("button", { name: pl.chat.reupload.prompt })).toBeInTheDocument();
  });

  it("hides the re-upload control when a decision already exists", async () => {
    stubFetchOk(
      hydration({
        analyses: [{ conclusive: true }],
        decisions: [{ status: "approved" }],
        messages: [assistantText("Cześć! Decyzja: Zaakceptowane.")],
      }),
    );
    render(<ChatShell caseId={CASE_ID} />);
    await screen.findByText(/Decyzja/);
    expect(screen.queryByRole("button", { name: pl.chat.reupload.prompt })).not.toBeInTheDocument();
  });

  it("hides the re-upload control after a conclusive decision part arrives from the stream", async () => {
    stubFetchOk(
      hydration({
        analyses: [{ conclusive: false }],
        decisions: [],
        messages: [assistantText("Cześć! Prześlij jedno lepsze zdjęcie sprzętu.")],
      }),
    );

    const runner: ChatStreamRunner = {
      async *run() {
        yield decisionAssistant();
      },
    };

    render(<ChatShell caseId={CASE_ID} createRunner={() => runner} />);
    expect(await screen.findByRole("button", { name: pl.chat.reupload.prompt })).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(pl.chat.inputPlaceholder);
    fireEvent.change(textarea, { target: { value: "Oto lepsze zdjęcie" } });
    fireEvent.submit(textarea.closest("form")!);

    // The decision block renders and the re-upload control disappears.
    await screen.findByText(pl.chat.decisionLabels.zaakceptowane);
    expect(screen.queryByRole("button", { name: pl.chat.reupload.prompt })).not.toBeInTheDocument();
  });

  it("shows a typing indicator and disables the input while streaming", async () => {
    stubFetchOk(
      hydration({
        decisions: [{ status: "approved" }],
        analyses: [{ conclusive: true }],
        messages: [assistantText("Cześć! Decyzja: Zaakceptowane.")],
      }),
    );

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const runner: ChatStreamRunner = {
      async *run() {
        await gate;
        yield assistantText("Oczywiście, chętnie pomogę.", "assist-reply");
      },
    };

    render(<ChatShell caseId={CASE_ID} createRunner={() => runner} />);
    const textarea = await screen.findByPlaceholderText(pl.chat.inputPlaceholder);
    fireEvent.change(textarea, { target: { value: "Mam pytanie" } });
    fireEvent.submit(textarea.closest("form")!);

    // While streaming: typing indicator visible, textarea disabled.
    await screen.findByText(pl.chat.typingIndicator);
    expect(screen.getByPlaceholderText(pl.chat.inputPlaceholder)).toBeDisabled();

    release();

    await screen.findByText("Oczywiście, chętnie pomogę.");
    await waitFor(() =>
      expect(screen.getByPlaceholderText(pl.chat.inputPlaceholder)).not.toBeDisabled(),
    );
    expect(screen.queryByText(pl.chat.typingIndicator)).not.toBeInTheDocument();
  });

  it("shows an inline error with a retry that re-sends the last user message on stream failure (AC-25)", async () => {
    stubFetchOk(
      hydration({
        decisions: [{ status: "approved" }],
        analyses: [{ conclusive: true }],
        messages: [assistantText("Cześć! Decyzja: Zaakceptowane.")],
      }),
    );

    const runCalls: UIMessage[][] = [];
    const runner: ChatStreamRunner = {
      async *run(messages) {
        runCalls.push(messages);
        throw new Error("stream failed");
      },
    };

    render(<ChatShell caseId={CASE_ID} createRunner={() => runner} />);
    const textarea = await screen.findByPlaceholderText(pl.chat.inputPlaceholder);
    fireEvent.change(textarea, { target: { value: "Czy dostanę zwrot?" } });
    fireEvent.submit(textarea.closest("form")!);

    await screen.findByText(pl.chat.streamError.message);
    expect(runCalls).toHaveLength(1);
    const lastPart = runCalls[0].at(-1)!.parts.at(-1) as { type: string; text?: string };
    expect(lastPart.text).toBe("Czy dostanę zwrot?");

    fireEvent.click(screen.getByRole("button", { name: pl.chat.streamError.retryButton }));

    await waitFor(() => expect(runCalls).toHaveLength(2));
    const retriedLast = runCalls[1].at(-1)!.parts.at(-1) as { type: string; text?: string };
    expect(retriedLast.text).toBe("Czy dostanę zwrot?");
  });

  it("confirms then navigates to '/' on 'Nowe zgłoszenie' (AC-30)", async () => {
    stubFetchOk(
      hydration({
        decisions: [{ status: "approved" }],
        analyses: [{ conclusive: true }],
        messages: [assistantText("Cześć! Decyzja: Zaakceptowane.")],
      }),
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<ChatShell caseId={CASE_ID} />);
    await screen.findByText(/Decyzja/);

    fireEvent.click(screen.getByRole("button", { name: pl.chat.newCase.buttonLabel }));

    expect(confirmSpy).toHaveBeenCalledWith(pl.chat.newCase.confirmMessage);
    expect(pushMock).toHaveBeenCalledWith("/");

    confirmSpy.mockRestore();
  });

  it("does not navigate when the 'Nowe zgłoszenie' confirmation is dismissed", async () => {
    stubFetchOk(
      hydration({
        decisions: [{ status: "approved" }],
        analyses: [{ conclusive: true }],
        messages: [assistantText("Cześć! Decyzja: Zaakceptowane.")],
      }),
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<ChatShell caseId={CASE_ID} />);
    await screen.findByText(/Decyzja/);

    fireEvent.click(screen.getByRole("button", { name: pl.chat.newCase.buttonLabel }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
