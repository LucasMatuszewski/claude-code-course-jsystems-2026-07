import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { UIMessage } from "ai";

import { pl } from "@/lib/i18n/pl";

// jsdom lacks ResizeObserver, which `use-stick-to-bottom` (used by the AI
// Elements Conversation) attaches during layout effects. Scope this no-op
// polyfill to this file so the shared vitest.setup.ts stays untouched (same
// pattern as RequestForm.test.tsx for pointer-capture / scrollIntoView).
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

// --- Mock useChat so component tests never hit a real endpoint -------------
// Drive the chat via a hoisted mutable stub. Each test configures the return
// value (`useChatMock.mockReturnValue(...)`) to exercise one slice of ChatView
// behavior (restore, streaming, error, ...). This is the "mock the chat
// transport/stream" approach sanctioned by ADR-002 §8: we mock the hook
// (which owns the transport) instead of constructing real UIMessageChunk
// streams — see the deviations note in the task report.
//
// `vi.hoisted` guarantees the stub exists before vi.mock's factory runs,
// sidestepping vitest's mock-factory hoisting rule.
const { useChatMock } = vi.hoisted(() => ({ useChatMock: vi.fn() }));
vi.mock("@ai-sdk/react", () => ({
  useChat: (...args: unknown[]) => useChatMock(...(args as never[])),
}));

import { ChatView, type ChatViewProps } from "./ChatView";
import type { ChatMessageMetadata } from "./MessageRow";

type ChatStub = {
  id?: string;
  messages?: UIMessage<ChatMessageMetadata>[];
  status?: "ready" | "submitted" | "streaming" | "error";
  error?: Error | undefined;
  sendMessage?: ReturnType<typeof vi.fn>;
  regenerate?: ReturnType<typeof vi.fn>;
};

function stubChat(overrides: ChatStub = {}) {
  const base = {
    id: "sess-test",
    messages: [] as UIMessage<ChatMessageMetadata>[],
    status: "ready" as const,
    error: undefined as Error | undefined,
    sendMessage: vi.fn(),
    regenerate: vi.fn(),
    stop: vi.fn(),
    clearError: vi.fn(),
    setMessages: vi.fn(),
  };
  const merged = { ...base, ...overrides };
  useChatMock.mockReturnValue(merged);
  return merged;
}

/** Capture the options ChatView passes to useChat (id, messages, transport). */
function captureUseChatOptions() {
  const calls = useChatMock.mock.calls;
  return calls[calls.length - 1]?.[0] as
    | (ChatViewProps & { id?: string })
    | undefined;
}

function userTextMsg(id: string, text: string): UIMessage<ChatMessageMetadata> {
  return { id, role: "user", parts: [{ type: "text", text }] };
}
function assistantTextMsg(
  id: string,
  text: string,
): UIMessage<ChatMessageMetadata> {
  return { id, role: "assistant", parts: [{ type: "text", text }] };
}

beforeEach(() => {
  useChatMock.mockReset();
});

describe("ChatView", () => {
  describe("wiring (ADR-002 §3, ADR-000 D8)", () => {
    it("initializes useChat with chat id = sessionId", () => {
      stubChat();
      render(<ChatView sessionId="sess-123" />);
      const opts = captureUseChatOptions();
      expect(opts?.id).toBe("sess-123");
    });

    it("passes the restored transcript as initialMessages (AC-27)", () => {
      stubChat();
      const initial = [
        assistantTextMsg("a1", "Witaj, oto Twoja decyzja."),
        userTextMsg("u1", "Dziękuję"),
      ];
      render(<ChatView sessionId="sess-1" messages={initial} />);
      const opts = captureUseChatOptions();
      expect(opts?.messages).toBe(initial);
    });

    it("defaults initialMessages to [] when none are provided", () => {
      stubChat();
      render(<ChatView sessionId="sess-1" />);
      const opts = captureUseChatOptions();
      expect(opts?.messages).toEqual([]);
    });

    it("configures a chat transport (POST /api/chat) by default", () => {
      stubChat();
      render(<ChatView sessionId="sess-1" />);
      const opts = captureUseChatOptions();
      // Transport is injected so the hook can talk to /api/chat. Its exact
      // class is asserted at the unit level in transport.test.ts.
      expect(opts?.transport).toBeDefined();
      expect(typeof opts?.transport?.sendMessages).toBe("function");
    });
  });

  describe("header (PRD §9.2)", () => {
    it("shows the session id label and value, and the new-request link", () => {
      stubChat();
      render(<ChatView sessionId="ABC-123" />);
      expect(screen.getByText(pl.chat.header.sessionIdLabel)).toBeInTheDocument();
      expect(screen.getByText("ABC-123")).toBeInTheDocument();
      const newRequestLink = screen.getByRole("link", {
        name: pl.chat.header.newRequestLink,
      });
      expect(newRequestLink).toHaveAttribute("href", "/");
    });
  });

  describe("restore (AC-27)", () => {
    it("renders every message from the chat state", () => {
      stubChat({
        messages: [
          assistantTextMsg("a1", "Pierwsza decyzja: REJECT"),
          userTextMsg("u1", "Dlaczego?"),
          assistantTextMsg("a2", "Ponieważ minął termin"),
        ],
      });
      render(<ChatView sessionId="sess-1" />);
      expect(screen.getByText(/Pierwsza decyzja/)).toBeInTheDocument();
      expect(screen.getByText("Dlaczego?")).toBeInTheDocument();
      expect(screen.getByText(/Ponieważ minął/)).toBeInTheDocument();
    });
  });

  describe("streaming / typing indicator (AC-23)", () => {
    it("shows the typing-indicator bubble while status is streaming", () => {
      stubChat({ status: "streaming" });
      render(<ChatView sessionId="sess-1" />);
      // role="status" with the Polish accessible name from the i18n module.
      expect(
        screen.getByRole("status", { name: pl.chat.typingIndicatorLabel }),
      ).toBeInTheDocument();
    });

    it("shows the typing-indicator bubble while status is submitted", () => {
      stubChat({ status: "submitted" });
      render(<ChatView sessionId="sess-1" />);
      expect(
        screen.getByRole("status", { name: pl.chat.typingIndicatorLabel }),
      ).toBeInTheDocument();
    });

    it("does NOT show the typing indicator when status is ready", () => {
      stubChat({ status: "ready" });
      render(<ChatView sessionId="sess-1" />);
      expect(
        screen.queryByRole("status", { name: pl.chat.typingIndicatorLabel }),
      ).toBeNull();
    });

    it("disables the chat send button while streaming (AC-23)", () => {
      stubChat({ status: "streaming" });
      render(<ChatView sessionId="sess-1" />);
      expect(
        screen.getByRole("button", { name: pl.chat.input.sendButton }),
      ).toBeDisabled();
    });
  });

  describe("reply failure + retry (AC-24)", () => {
    it("renders an inline error row with the Polish retry button", () => {
      stubChat({ status: "error", error: new Error("upstream timeout") });
      render(<ChatView sessionId="sess-1" />);
      expect(
        screen.getByRole("button", { name: pl.chat.retryButton }),
      ).toBeInTheDocument();
    });

    it("clicking retry calls regenerate for the failed turn", async () => {
      const regenerate = vi.fn();
      stubChat({
        status: "error",
        error: new Error("upstream timeout"),
        regenerate,
      });
      render(<ChatView sessionId="sess-1" />);
      await userEvent.click(
        screen.getByRole("button", { name: pl.chat.retryButton }),
      );
      expect(regenerate).toHaveBeenCalledTimes(1);
    });

    it("preserves conversation history while in the error state (AC-24)", () => {
      stubChat({
        status: "error",
        error: new Error("fail"),
        messages: [
          assistantTextMsg("a1", "decyzja"),
          userTextMsg("u1", "pytanie"),
        ],
      });
      render(<ChatView sessionId="sess-1" />);
      // The error row appears, but prior messages are still rendered.
      expect(screen.getByText("decyzja")).toBeInTheDocument();
      expect(screen.getByText("pytanie")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: pl.chat.retryButton }),
      ).toBeInTheDocument();
    });
  });

  describe("sending a message", () => {
    it("calls chat.sendMessage with the typed text when Enter is pressed", async () => {
      const sendMessage = vi.fn();
      stubChat({ status: "ready", sendMessage });
      render(<ChatView sessionId="sess-1" />);
      const textbox = screen.getByRole("textbox");
      await userEvent.type(textbox, "Mam paragon");
      await userEvent.keyboard("{Enter}");
      expect(sendMessage).toHaveBeenCalledTimes(1);
      // The SDK's sendMessage accepts { text } for a text-only turn.
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Mam paragon" }),
      );
    });
  });

  describe("text-only guarantee (AC-20)", () => {
    it("renders no file/upload affordance anywhere", () => {
      stubChat();
      const { container } = render(<ChatView sessionId="sess-1" />);
      expect(container.querySelector('input[type="file"]')).toBeNull();
      expect(
        screen.queryByRole("button", { name: /upload|załącz|dodaj/i }),
      ).toBeNull();
    });
  });

  describe("scroll container", () => {
    it("exposes the conversation scroll region as a log (accessibility)", () => {
      stubChat({
        messages: [assistantTextMsg("a1", "Witaj")],
      });
      render(<ChatView sessionId="sess-1" />);
      const log = screen.getByRole("log");
      // The first assistant decision message is visible inside the log.
      expect(within(log).getByText(/Witaj/)).toBeInTheDocument();
    });
  });
});
