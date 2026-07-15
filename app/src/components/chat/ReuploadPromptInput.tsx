"use client";

/**
 * Chat composer (ADR-004 §3 "Re-upload control"; PRD §9.2; AC-22/AC-24).
 *
 * A single AI Elements `PromptInput`. When `showAttachment` is true (the agent
 * has asked for a better photo) it exposes the image-attachment affordance
 * with the SAME constraints as the form (AC-05/AC-22: JPG/PNG/WebP, ≤10 MB,
 * one file); otherwise the composer is text-only. Whether the affordance is
 * shown is decided by the parent from the conversation messages
 * (TAC-004-02) — this component holds no decision state of its own.
 *
 * While a turn is in flight (`busy`) the textarea and submit are disabled
 * (AC-24); `status` drives the submit button's spinner/stop icon.
 */

import { useState } from "react";
import type { FileUIPart } from "ai";
import { ImageIcon } from "lucide-react";

import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { pl } from "@/lib/copy/pl";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from "@/lib/validation/case-form.schema";
import type { ChatStatus } from "./useCaseChat";

export interface ReuploadPromptInputProps {
  /** Whether the image-attachment affordance is available (AC-22). */
  showAttachment: boolean;
  /** A turn is in flight — disable input (AC-24). */
  busy: boolean;
  status: ChatStatus;
  onSend: (args: { text: string; files: FileUIPart[] }) => void;
}

/** Previews of currently-staged attachments; lives inside `PromptInput`. */
function StagedAttachments() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) {
    return null;
  }
  return (
    <Attachments variant="list" className="px-3 pt-3">
      {attachments.files.map((file) => (
        <Attachment data={file} key={file.id} onRemove={() => attachments.remove(file.id)}>
          <AttachmentPreview />
          <AttachmentInfo />
          <AttachmentRemove label={pl.form.fields.image.removeButton} />
        </Attachment>
      ))}
    </Attachments>
  );
}

/** Opens the native file dialog; lives inside `PromptInput`. */
function AttachButton({ disabled }: { disabled: boolean }) {
  const attachments = usePromptInputAttachments();
  return (
    <PromptInputButton
      aria-label={pl.chat.reupload.prompt}
      disabled={disabled}
      onClick={() => attachments.openFileDialog()}
      type="button"
    >
      <ImageIcon className="size-4" />
    </PromptInputButton>
  );
}

export function ReuploadPromptInput({
  showAttachment,
  busy,
  status,
  onSend,
}: ReuploadPromptInputProps) {
  const [fileError, setFileError] = useState<string | null>(null);

  function handleSubmit(message: PromptInputMessage) {
    setFileError(null);
    const text = message.text?.trim() ?? "";
    const files = message.files ?? [];
    if (!text && files.length === 0) {
      return;
    }
    onSend({ text, files });
  }

  function handleError(err: { code: "max_files" | "max_file_size" | "accept" }) {
    setFileError(
      err.code === "max_file_size"
        ? pl.form.errors.imageTooLarge
        : pl.form.errors.imageInvalidType,
    );
  }

  return (
    <div className="border-t bg-background p-3">
      {showAttachment && (
        <p className="mb-2 px-1 text-xs text-muted-foreground">
          {pl.chat.reupload.prompt} {pl.chat.reupload.helper}
        </p>
      )}
      <PromptInput
        accept={showAttachment ? ALLOWED_IMAGE_MIME_TYPES.join(",") : undefined}
        className="rounded-2xl border"
        maxFileSize={MAX_IMAGE_SIZE_BYTES}
        maxFiles={1}
        multiple={false}
        onError={handleError}
        onSubmit={handleSubmit}
      >
        {showAttachment && <StagedAttachments />}
        <PromptInputBody>
          <PromptInputTextarea disabled={busy} placeholder={pl.chat.inputPlaceholder} />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            {showAttachment && <AttachButton disabled={busy} />}
          </PromptInputTools>
          <PromptInputSubmit disabled={busy} status={status} />
        </PromptInputFooter>
      </PromptInput>
      {fileError && (
        <p className="mt-2 px-1 text-sm text-destructive" role="alert">
          {fileError}
        </p>
      )}
    </div>
  );
}
