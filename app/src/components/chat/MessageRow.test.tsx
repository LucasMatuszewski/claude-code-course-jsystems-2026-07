import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { UIMessage } from "ai";

import { MessageRow, type ChatMessageMetadata } from "./MessageRow";

function textMsg(
  id: string,
  role: "user" | "assistant",
  text: string,
  metadata?: ChatMessageMetadata,
): UIMessage<ChatMessageMetadata> {
  return { id, role, parts: [{ type: "text", text }], metadata };
}

describe("MessageRow (PRD §9.2 alignment + timestamps)", () => {
  it("aligns customer (user) messages to the right", () => {
    const { container } = render(
      <MessageRow message={textMsg("u1", "user", "Dzień dobry")} />,
    );
    const bubble = container.querySelector('[data-role="user"]');
    expect(bubble).not.toBeNull();
    // The AI Elements `Message` component flags alignment via these classes.
    expect(bubble?.classList.contains("is-user")).toBe(true);
    expect(bubble?.classList.contains("is-assistant")).toBe(false);
  });

  it("aligns agent (assistant) messages to the left", () => {
    const { container } = render(
      <MessageRow message={textMsg("a1", "assistant", "Witaj!")} />,
    );
    const bubble = container.querySelector('[data-role="assistant"]');
    expect(bubble).not.toBeNull();
    expect(bubble?.classList.contains("is-assistant")).toBe(true);
    expect(bubble?.classList.contains("is-user")).toBe(false);
  });

  it("renders the text content (markdown) of text parts", () => {
    render(<MessageRow message={textMsg("a1", "assistant", "Witaj **świecie**")} />);
    expect(screen.getByText(/Witaj/)).toBeInTheDocument();
    expect(screen.getByText("świecie")).toBeInTheDocument();
  });

  it("renders a timestamp from message.metadata.createdAt when present", () => {
    render(
      <MessageRow
        message={textMsg("a1", "assistant", "Cześć", {
          createdAt: "2026-07-16T09:05:00.000Z",
        })}
      />,
    );
    const time = screen.getByRole("time") ?? document.querySelector("time");
    expect(time).not.toBeNull();
    // dateTime preserves the ISO source-of-truth; visible text is localized.
    expect(time).toHaveAttribute("dateTime", "2026-07-16T09:05:00.000Z");
    // pl-PL HH:MM formatting (hour and minute, 2-digit).
    expect(time.textContent).toMatch(/\d{2}:\d{2}/);
  });

  it("renders no timestamp element when createdAt is absent (graceful)", () => {
    const { container } = render(
      <MessageRow message={textMsg("a1", "assistant", "Cześć")} />,
    );
    expect(container.querySelector("time")).toBeNull();
  });

  it("tolerates unknown part types without crashing", () => {
    // T4.5 seam: decision/tool parts are not built yet — they must not break
    // rendering and must be silently skipped (ADR-002 §3 "tolerate unknown
    // part types gracefully").
    const message = {
      id: "a1",
      role: "assistant" as const,
      parts: [
        { type: "text", text: "Before unknown" },
        { type: "custom", kind: "t4.future-decision-block" },
        { type: "text", text: "After unknown" },
      ],
    };

    expect(() => render(<MessageRow message={message} />)).not.toThrow();
    expect(screen.getByText(/Before unknown/)).toBeInTheDocument();
    expect(screen.getByText(/After unknown/)).toBeInTheDocument();
  });

  it("renders an empty bubble (no crash) when a message has no parts", () => {
    const message = { id: "a1", role: "assistant" as const, parts: [] };
    expect(() => render(<MessageRow message={message} />)).not.toThrow();
  });
});
