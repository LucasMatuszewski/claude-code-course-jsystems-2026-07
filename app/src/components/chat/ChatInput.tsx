"use client";

import { Button } from "@/components/ui/button";
import { pl } from "@/lib/i18n/pl";
import { cn } from "@/lib/utils";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/lib/validation";
import { SendIcon } from "lucide-react";
import { useId, useState, type FormEvent, type KeyboardEvent } from "react";

/**
 * Minimal, chat-tailored prompt input (PRD §9.2; AC-18/AC-20/AC-23).
 *
 * Replaces the installed AI Elements `prompt-input.tsx`, which always renders
 * a hidden `<input type="file">`, drag-and-drop handlers, and a paste-file
 * pipeline — all of which violate AC-20 ("the chat input accepts text only").
 * This component is intentionally text-only: no file input, no dropzone, no
 * attachment handling anywhere in the DOM.
 *
 * Behavior:
 * - Growing textarea (`field-sizing-content` clamped to a max height).
 * - Enter sends; Shift+Enter inserts a newline (PRD §9.2).
 * - Character counter `n / 2000` with the shared Polish accessible label.
 * - Send is blocked when the input is empty, whitespace-only, OR over the
 *   2000-char limit (AC-18). Paste over the limit is blocked the same way.
 * - When `disabled` (set while `useChat` status is streaming/submitted), the
 *   send button is disabled but the textarea stays editable so the customer
 *   can keep typing (AC-23). Rapid Enter while disabled issues no send
 *   (TAC-002-04) — `canSend` short-circuits before `onSend` runs.
 */
export type ChatInputProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
  maxLength?: number;
};

export function ChatInput({
  onSend,
  disabled = false,
  maxLength = CHAT_MESSAGE_MAX_LENGTH,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  // Stable id so the visible counter and the textarea stay correctly labelled
  // across re-renders without per-render churn.
  const counterId = useId();

  const trimmedLength = value.trim().length;
  const overLimit = value.length > maxLength;
  const canSend = !disabled && !overLimit && trimmedLength > 0;

  function send() {
    if (!canSend) {
      return;
    }
    // Trim on send so the server and the transcript never receive a
    // whitespace-only message (mirrors the shared chat-message Zod schema,
    // which rejects whitespace-only input — TAC-002-01).
    const trimmed = value.trim();
    setValue("");
    onSend(trimmed);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") {
      return;
    }
    // Respect IME composition (Enter confirms the composition; must not send).
    if (event.nativeEvent.isComposing) {
      return;
    }
    // Shift+Enter: let the browser insert a newline (default behavior).
    if (event.shiftKey) {
      return;
    }
    // Plain Enter: prevent the newline and send instead.
    event.preventDefault();
    send();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border-strong border-t bg-background-light px-md py-sm"
      aria-label={pl.chat.input.sendButton}
    >
      <div className="bg-card flex flex-col gap-2 rounded-[var(--radius-play-md)] border p-2 focus-within:border-ring">
        <textarea
          aria-label={pl.chat.input.placeholder}
          className={cn(
            "field-sizing-content max-h-48 min-h-16 w-full resize-none bg-transparent text-sm outline-none placeholder:text-text-secondary",
            overLimit && "text-destructive",
          )}
          // Allow typing slightly past the limit so the over-limit UI state is
          // reachable; the JS guard above is the real 2000-char enforcement.
          maxLength={maxLength + 200}
          onChange={(event) => setValue(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={pl.chat.input.placeholder}
          rows={1}
          value={value}
        />
        <div className="flex items-center justify-between gap-sm">
          <span
            aria-label={pl.common.characterCounterAriaLabel(
              value.length,
              maxLength,
            )}
            className={cn(
              "text-text-secondary text-xs",
              overLimit && "text-destructive",
            )}
            data-testid={counterId}
          >
            {value.length} / {maxLength}
          </span>
          <Button
            disabled={!canSend}
            size="sm"
            type="submit"
            variant="default"
          >
            <SendIcon className="size-4" />
            {pl.chat.input.sendButton}
          </Button>
        </div>
      </div>
    </form>
  );
}
