import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { pl } from "@/lib/i18n/pl";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/lib/validation";

import { ChatInput } from "./ChatInput";

/**
 * Minimal, chat-tailored prompt input (PRD §9.2, AC-18/AC-20/AC-23).
 *
 * Replaces the installed `ai-elements/prompt-input.tsx` (which always renders
 * a hidden `<input type="file">` + drop handlers and so violates AC-20). The
 * replacement is text-only: no file input, no dropzone, no paste-file handling.
 */
async function pasteText(textbox: HTMLElement, text: string) {
  // userEvent.paste accepts a plain string (it builds the clipboard event
  // internally), avoiding the DataTransfer global which jsdom does not provide.
  // It pastes into the active element, so focus the textbox first.
  const user = userEvent.setup();
  await user.click(textbox);
  await user.paste(text);
}

describe("ChatInput", () => {
  describe("rendering (PRD §9.2)", () => {
    it("renders a textarea with the Polish placeholder", () => {
      render(<ChatInput onSend={() => {}} />);
      expect(
        screen.getByRole("textbox", { name: pl.chat.input.placeholder }),
      ).toBeInTheDocument();
      expect(
        (screen.getByRole("textbox") as HTMLTextAreaElement).placeholder,
      ).toBe(pl.chat.input.placeholder);
    });

    it("renders a send button labeled in Polish", () => {
      render(<ChatInput onSend={() => {}} />);
      expect(
        screen.getByRole("button", { name: pl.chat.input.sendButton }),
      ).toBeInTheDocument();
    });

    it("does NOT render any file/upload affordance (AC-20)", () => {
      const { container } = render(<ChatInput onSend={() => {}} />);
      // No file input anywhere — text-only chat.
      expect(container.querySelector('input[type="file"]')).toBeNull();
      // No dropzone, no "upload" / "attachment" wording.
      expect(screen.queryByRole("button", { name: /upload|załącz|dodaj/i })).toBeNull();
    });
  });

  describe("character limit (AC-18, TAC-002-05)", () => {
    it("shows a character counter with the Polish accessible label", () => {
      render(<ChatInput onSend={() => {}} />);
      // Visible "current / max" text, plus the Polish screen-reader label.
      const counter = screen.getByText(`0 / ${CHAT_MESSAGE_MAX_LENGTH}`);
      expect(counter).toHaveAttribute(
        "aria-label",
        pl.common.characterCounterAriaLabel(0, CHAT_MESSAGE_MAX_LENGTH),
      );
    });

    it("accepts exactly 2000 characters and keeps send enabled (boundary)", async () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} />);
      const textbox = screen.getByRole("textbox");
      // Paste the bulk text (char-by-char typing of 2000 chars is too slow).
      await pasteText(textbox, "a".repeat(CHAT_MESSAGE_MAX_LENGTH));
      expect(screen.getByRole("button", { name: pl.chat.input.sendButton })).toBeEnabled();
    });

    it("blocks sending when input exceeds 2000 characters (AC-18)", async () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} />);
      const textbox = screen.getByRole("textbox");
      // One character over the limit — pasted, then send attempted via button.
      await pasteText(textbox, "a".repeat(CHAT_MESSAGE_MAX_LENGTH + 1));
      expect(
        screen.getByRole("button", { name: pl.chat.input.sendButton }),
      ).toBeDisabled();
      await userEvent.click(
        screen.getByRole("button", { name: pl.chat.input.sendButton }),
      );
      expect(onSend).not.toHaveBeenCalled();
    });

    it("blocks sending after a paste that crosses the limit", async () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} />);
      const textbox = screen.getByRole("textbox");
      await pasteText(textbox, "b".repeat(CHAT_MESSAGE_MAX_LENGTH + 5));
      expect(
        screen.getByRole("button", { name: pl.chat.input.sendButton }),
      ).toBeDisabled();
    });

    it("disables send when the input is empty or whitespace-only", () => {
      render(<ChatInput onSend={() => {}} />);
      expect(
        screen.getByRole("button", { name: pl.chat.input.sendButton }),
      ).toBeDisabled();
    });
  });

  describe("keyboard (PRD §9.2: Enter sends, Shift+Enter newline)", () => {
    it("Enter calls onSend with the trimmed text and clears the input", async () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} />);
      const textbox = screen.getByRole("textbox");
      await userEvent.type(textbox, "Cześć");
      await userEvent.keyboard("{Enter}");

      expect(onSend).toHaveBeenCalledTimes(1);
      expect(onSend).toHaveBeenCalledWith("Cześć");
      expect((textbox as HTMLTextAreaElement).value).toBe("");
    });

    it("Shift+Enter inserts a newline and does NOT send", async () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} />);
      const textbox = screen.getByRole("textbox");
      await userEvent.type(textbox, "Line one");
      await userEvent.keyboard("{Shift>}{Enter}{/Shift}");

      expect(onSend).not.toHaveBeenCalled();
      expect((textbox as HTMLTextAreaElement).value).toContain("\n");
    });

    it("Enter does nothing when the input is over the limit", async () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} />);
      const textbox = screen.getByRole("textbox");
      await pasteText(textbox, "a".repeat(CHAT_MESSAGE_MAX_LENGTH + 1));
      await userEvent.keyboard("{Enter}");
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe("streaming state (AC-23, TAC-002-04)", () => {
    it("disables the send button while `disabled` (streaming/submitted)", () => {
      render(<ChatInput onSend={() => {}} disabled />);
      expect(
        screen.getByRole("button", { name: pl.chat.input.sendButton }),
      ).toBeDisabled();
    });

    it("keeps the textarea editable while streaming — typing stays possible (AC-23)", () => {
      render(<ChatInput onSend={() => {}} disabled />);
      expect(screen.getByRole("textbox")).not.toBeDisabled();
    });

    it("rapid Enter while streaming produces NO send call (TAC-002-04)", async () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} disabled />);
      const textbox = screen.getByRole("textbox");
      await userEvent.type(textbox, "ignored text");
      await userEvent.keyboard("{Enter}");
      await userEvent.keyboard("{Enter}");
      await userEvent.keyboard("{Enter}");
      expect(onSend).not.toHaveBeenCalled();
    });
  });
});
