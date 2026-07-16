"use client";

import * as React from "react";
import { Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { pl } from "@/lib/i18n/pl";
import { cn } from "@/lib/utils";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  imageFileMetaSchema,
  type ImageFileMeta,
} from "@/lib/validation";

/**
 * Variant of the helper text shown beneath the dropzone. The parent decides
 * which one applies based on the selected request type (PRD 9.1: the image
 * helper text changes with request type). See `pl.form.fields.image.helperText`.
 */
export type ImageUploadVariant = "complaint" | "return";

export interface ImageUploadProps {
  /** Which helper-text string to render. Driven by the request-type field. */
  variant: ImageUploadVariant;
  /**
   * Notifies the parent whenever the selected file changes. Receives `null`
   * when the user removes the file or picks an invalid one, so the parent
   * can keep its form state in sync (used by T4.3 to drive AC-05 submit
   * gating and the multipart upload).
   */
  onFileChange?: (file: File | null) => void;
  /** Optional id for the file input; a stable React.useId() is used by default. */
  id?: string;
  /** Optional className for the root wrapper. */
  className?: string;
}

/**
 * `accept` attribute value derived from the single source of truth so the
 * native picker filters to the same set the JS validator enforces.
 */
const ACCEPT_ATTRIBUTE = ALLOWED_IMAGE_MIME_TYPES.join(",");

/**
 * Formats a byte count with the Polish locale and a narrow "B" unit suffix.
 * Pure data formatting — no user-facing Polish literal lives here, the unit
 * comes from Intl.
 */
function formatFileSize(bytes: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "unit",
    unit: "byte",
    unitDisplay: "narrow",
  }).format(bytes);
}

/**
 * ImageUpload — single-file drop zone + file picker for the request form
 * (PRD §9.1 image element, AC-05, AC-06, ADR-002 §3 image-field paragraph).
 *
 * Client-side validation reuses the shared `imageFileMetaSchema` so the
 * client rejects exactly the same inputs the server rejects, with the same
 * Polish wording (TAC-002-01). The selected `File` (or `null`) is published
 * to the parent via `onFileChange`.
 *
 * The object URL used for the thumbnail preview is revoked whenever it is
 * replaced or the component unmounts (see the `useEffect` cleanup below).
 */
export function ImageUpload({
  variant,
  onFileChange,
  id,
  className,
}: ImageUploadProps) {
  const reactInputId = React.useId();
  const inputId = id ?? reactInputId;

  const [file, setFile] = React.useState<File | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);

  // Release the previous object URL whenever it is replaced or the component
  // unmounts. The effect closes over a specific URL string; when `previewUrl`
  // changes (to a new URL or to null) the prior cleanup runs and revokes the
  // old URL. This covers: removal, re-select, swap, and unmount.
  React.useEffect(() => {
    if (previewUrl === null) {
      return;
    }
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const notifyParent = React.useCallback(
    (next: File | null) => {
      onFileChange?.(next);
    },
    [onFileChange],
  );

  const applySelection = React.useCallback(
    (candidate: File | null) => {
      if (candidate === null) {
        setPreviewUrl(null);
        setFile(null);
        setErrorMessage(null);
        notifyParent(null);
        return;
      }

      const meta: ImageFileMeta = {
        type: candidate.type,
        size: candidate.size,
      };
      const result = imageFileMetaSchema.safeParse(meta);
      if (!result.success) {
        // AC-05: a single Polish message that already names every allowed
        // format and the 10 MB cap (see VALIDATION_MESSAGES_PL.imageInvalid).
        const message = result.error.issues[0]?.message ?? null;
        setPreviewUrl(null);
        setFile(null);
        setErrorMessage(message);
        notifyParent(null);
        return;
      }

      // Valid: mint a fresh object URL. The effect cleanup above releases
      // the previous one if any.
      const url = URL.createObjectURL(candidate);
      setPreviewUrl(url);
      setFile(candidate);
      setErrorMessage(null);
      notifyParent(candidate);
    },
    [notifyParent],
  );

  const handleInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files?.[0] ?? null;
      applySelection(selected);
      // Reset the value so selecting the SAME file again (e.g. after remove)
      // still fires a `change` event.
      event.target.value = "";
    },
    [applySelection],
  );

  const handleRemove = React.useCallback(() => {
    applySelection(null);
  }, [applySelection]);

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
      const dropped = event.dataTransfer.files?.[0] ?? null;
      applySelection(dropped);
    },
    [applySelection],
  );

  const handleDragOver = React.useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setIsDragOver(true);
    },
    [],
  );

  const handleDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setIsDragOver(false);
    },
    [],
  );

  const helperText = pl.form.fields.image.helperText[variant];
  const fieldLabel = pl.form.fields.image.label;
  const dropzoneHint = pl.form.fields.image.dropzoneHint;
  const changeButtonLabel = pl.form.fields.image.changeButton;
  const removeButtonLabel = pl.form.fields.image.removeButton;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-foreground"
      >
        {fieldLabel}
      </label>
      <label
        htmlFor={inputId}
        data-testid="image-upload-dropzone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-play-md)] border border-dashed bg-background-subtle px-6 py-8 text-center transition-colors",
          "border-border-strong",
          isDragOver && "border-brand-primary bg-background-light",
          errorMessage !== null && "border-destructive",
        )}
      >
        <Upload
          className="size-5 text-brand-primary"
          aria-hidden="true"
        />
        <span className="text-sm text-text-secondary">
          {file !== null ? changeButtonLabel : dropzoneHint}
        </span>
        <input
          id={inputId}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          onChange={handleInputChange}
          className="sr-only"
          aria-invalid={errorMessage !== null}
          aria-describedby={
            errorMessage !== null ? `${inputId}-error` : `${inputId}-helper`
          }
        />
      </label>
      {errorMessage !== null ? (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-sm text-destructive"
        >
          {errorMessage}
        </p>
      ) : (
        <p
          id={`${inputId}-helper`}
          className="text-sm text-text-secondary"
        >
          {helperText}
        </p>
      )}
      {file !== null && previewUrl !== null && (
        <div
          className="flex items-center gap-3 rounded-[var(--radius-play-md)] border border-border bg-background-light p-3"
          data-testid="image-upload-preview"
        >
          {/*
            Native <img> is intentional: the preview src is a blob: object URL,
            which next/image cannot optimize (it would need a remote pattern
            for an unknown blob host and would still bypass its optimizer).
            The lint rule is disabled inline for this single use.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={file.name}
            className="size-16 rounded-[var(--radius-play-sm)] object-cover"
          />
          <div className="flex flex-1 flex-col">
            <span className="break-all text-sm font-medium text-foreground">
              {file.name}
            </span>
            <span className="text-xs text-text-secondary">
              {formatFileSize(file.size)}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
          >
            <X className="size-3.5" aria-hidden="true" />
            {removeButtonLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
