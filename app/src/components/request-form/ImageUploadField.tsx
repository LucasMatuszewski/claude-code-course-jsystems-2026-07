"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ChangeEvent, DragEvent } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { pl } from "@/lib/copy/pl";

interface ImageUploadFieldProps {
  inputId: string;
  file: File | null;
  error?: string;
  onSelect: (file: File | null) => void;
}

/**
 * Image upload control for the request form (PRD §9.1): drag-and-drop area
 * + file picker button, filename + thumbnail preview after selection, and a
 * remove button. Client-side format/size pre-checks happen in the parent
 * (`RequestForm`, AC-05); this component only surfaces the already-computed
 * error message.
 */
export function ImageUploadField({ inputId, file, error, onSelect }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Real browsers always have URL.createObjectURL; guarded defensively so a
  // missing implementation only loses the thumbnail, never the filename.
  const previewUrl = useMemo(() => {
    if (!file) return null;
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return null;
    try {
      return URL.createObjectURL(file);
    } catch {
      return null;
    }
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFiles(files: FileList | null) {
    onSelect(files && files.length > 0 ? files[0] : null);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFiles(event.target.files);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        {pl.form.fields.image.label}
      </label>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-input p-4 text-center"
      >
        {file ? (
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  className="size-10 rounded-md object-cover"
                />
              ) : null}
              <span className="text-sm">{file.name}</span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onSelect(null)}>
              {pl.form.fields.image.removeButton}
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{pl.form.fields.image.dropzoneText}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              {pl.form.fields.image.pickButton}
            </Button>
          </>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleInputChange}
        />
      </div>
      <p className="text-xs text-muted-foreground">{pl.form.fields.image.helper}</p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
