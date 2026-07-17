import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { SessionHistory } from "./restore";

vi.mock("@/lib/db/client", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/db/repositories", () => ({ getSessionWithHistory: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/components/chat/ChatView", () => ({
  ChatView: (props: unknown) => (
    <div data-testid="chat-view" data-props={JSON.stringify(props)} />
  ),
}));

import { getDb } from "@/lib/db/client";
import { getSessionWithHistory } from "@/lib/db/repositories";
import { notFound } from "next/navigation";

import ChatSessionPage from "./page";

const getDbMock = vi.mocked(getDb);
const getSessionWithHistoryMock = vi.mocked(getSessionWithHistory);
const notFoundMock = vi.mocked(notFound);

function minimalHistory(): SessionHistory {
  return {
    session: {
      id: "abc",
      requestType: "complaint",
      category: "laptop",
      productName: "Nexon X15",
      purchaseDate: "2026-07-01",
      reason: "Opis",
      imagePath: "data/uploads/abc.jpg",
      imageOriginalName: "photo.jpg",
      imageMediaType: "image/jpeg",
      visionAnalysis: null,
      status: "analyzed",
      createdAt: 1_700_000_000_000,
    },
    decisions: [
      {
        id: 1,
        sessionId: "abc",
        decision: "APPROVE",
        previousDecision: null,
        justification: "Uzasadnienie",
        citedRuleIds: "[]",
        source: "initial",
        guardOverride: false,
        createdAt: 1_700_000_000_001,
      },
    ],
    messages: [
      {
        id: "assistant-1",
        sessionId: "abc",
        role: "assistant",
        parts: JSON.stringify([{ type: "text", text: "Dzień dobry." }]),
        createdAt: 1_700_000_000_002,
      },
    ],
  };
}

describe("ChatSessionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDbMock.mockReturnValue({} as ReturnType<typeof getDb>);
  });

  it("calls notFound and renders nothing when the session does not exist", async () => {
    getSessionWithHistoryMock.mockReturnValue(null);

    const jsx = await ChatSessionPage({
      params: Promise.resolve({ sessionId: "missing" }),
    });
    const { container } = render(jsx);

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("chat-view")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it("loads history and renders ChatView with restored messages", async () => {
    const history = minimalHistory();
    getSessionWithHistoryMock.mockReturnValue(history);

    const jsx = await ChatSessionPage({
      params: Promise.resolve({ sessionId: "abc" }),
    });
    render(jsx);

    expect(getSessionWithHistoryMock).toHaveBeenCalledWith(getDbMock(), "abc");
    expect(notFoundMock).not.toHaveBeenCalled();

    const props = JSON.parse(
      screen.getByTestId("chat-view").getAttribute("data-props") ?? "{}",
    ) as {
      sessionId?: string;
      messages?: Array<{ id: string; parts: Array<{ type: string }> }>;
    };
    expect(props.sessionId).toBe("abc");
    expect(props.messages?.[0]?.id).toBe("assistant-1");
    expect(props.messages?.[0]?.parts[0]?.type).toBe("data-decision");
  });
});
