"use client";

import * as React from "react";
import { format } from "date-fns";
import { pl as plLocale } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { pl } from "@/lib/i18n/pl";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABELS,
  CATEGORY_VALUES,
  REASON_MAX_LENGTH,
  REQUEST_TYPE_LABELS,
  REQUEST_TYPE_VALUES,
  getFieldErrors,
  requestFormSchema,
  type Category,
  type ImageFileMeta,
  type RequestType,
} from "@/lib/validation";

/**
 * RequestForm (PRD §9.1, ADR-002 §3 "Form area")
 * ----------------
 * Controlled, manually-validated form for the customer return/complaint
 * request. Form state is local React state (no react-hook-form — not installed,
 * see app/AGENTS.md); validation runs the shared `requestFormSchema` from
 * `@/lib/validation` on submit, then per-field on every change after the first
 * submit attempt, so client and server enforce identical rules with identical
 * Polish messages (TAC-002-01).
 *
 * The image field is rendered through the `imageSlot` prop and validated via the
 * `imageValue` prop: in T4.1 the default placeholder area is shown and
 * `imageValue` is undefined (so `imageRequired` surfaces on submit); T4.2's
 * `ImageUpload` is injected through `imageSlot` and its selected file passed via
 * `imageValue` by the wiring task T4.3.
 */

/** Polish, schema-validated form values handed to the parent on a valid submit. */
export interface RequestFormValues {
  requestType: RequestType;
  category: Category;
  productName: string;
  /** Local-time ISO date `YYYY-MM-DD` (matches `todayIsoDate`, no UTC drift). */
  purchaseDate: string;
  reason?: string;
}

export interface RequestFormProps {
  /** Called exactly once per valid submission with the parsed form values. */
  onSubmit: (values: RequestFormValues) => void;
  /** Rendered in the image slot. T4.3 injects the real `ImageUpload` here. */
  imageSlot?: React.ReactNode;
  /**
   * Metadata for the selected image. Validated by the same `requestFormSchema`
   * (AC-05) so the form stays invalid until a compliant file is provided.
   * Owned by the parent in T4.3 (the `ImageUpload` state); `undefined` in T4.1.
   */
  imageValue?: ImageFileMeta;
  /** Disable every field and the submit button (submission state machine, AC-07). */
  disabled?: boolean;
  className?: string;
}

type FieldName =
  | "requestType"
  | "category"
  | "productName"
  | "purchaseDate"
  | "reason"
  | "image";

interface FieldValues {
  requestType: RequestType | "";
  category: Category | "";
  productName: string;
  purchaseDate: string;
  reason: string;
}

const INITIAL_VALUES: FieldValues = {
  requestType: "",
  category: "",
  productName: "",
  purchaseDate: "",
  reason: "",
};

/** Parse a local `YYYY-MM-DD` string into a local Date (no UTC drift). */
function isoToLocalDate(iso: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Format a local Date back into a local `YYYY-MM-DD` string. */
function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function RequestForm({
  onSubmit,
  imageSlot,
  imageValue,
  disabled = false,
  className,
}: RequestFormProps) {
  const requestTypeId = React.useId();
  const categoryId = React.useId();
  const productNameId = React.useId();
  const purchaseDateId = React.useId();
  const reasonId = React.useId();
  const imageId = React.useId();

  const [values, setValues] = React.useState<FieldValues>(INITIAL_VALUES);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  // After the first submit attempt, every subsequent change re-validates so the
  // customer gets live feedback as they fix each field (ADR-002 §3).
  const [submitted, setSubmitted] = React.useState(false);

  // End of today (local) — the calendar disables strictly later dates, matching
  // the schema's `value > todayIsoDate()` boundary exactly (AC-04).
  const endOfToday = React.useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  // Run the shared schema against the current field values + the parent-owned
  // image metadata. Empty purchaseDate is coerced to undefined so the schema
  // emits `purchaseDateRequired` (constructor error) rather than `invalid`.
  const runSchema = React.useCallback(
    (next: FieldValues) =>
      requestFormSchema.safeParse({
        requestType: next.requestType,
        category: next.category,
        productName: next.productName,
        purchaseDate: next.purchaseDate || undefined,
        reason: next.reason,
        image: imageValue,
      }),
    [imageValue],
  );

  function focusFirstInvalid(errs: Record<string, string>) {
    const ids: Array<[FieldName, string]> = [
      ["requestType", requestTypeId],
      ["category", categoryId],
      ["productName", productNameId],
      ["purchaseDate", purchaseDateId],
      ["reason", reasonId],
      ["image", imageId],
    ];
    for (const [name, id] of ids) {
      if (errs[name]) {
        document.getElementById(id)?.focus();
        return;
      }
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    setSubmitted(true);

    const result = runSchema(values);
    if (result.success) {
      setErrors({});
      const v = result.data;
      onSubmit({
        requestType: v.requestType,
        category: v.category,
        productName: v.productName,
        purchaseDate: v.purchaseDate,
        reason: v.reason,
      });
      return;
    }
    const errs = getFieldErrors(result.error);
    setErrors(errs);
    focusFirstInvalid(errs);
  }

  function updateField<K extends keyof FieldValues>(key: K, value: FieldValues[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (submitted) {
      const result = runSchema(next);
      setErrors(result.success ? {} : getFieldErrors(result.error));
    }
  }

  const isComplaint = values.requestType === "complaint";
  const reasonLabelText = isComplaint
    ? pl.form.fields.reason.labelRequired
    : pl.form.fields.reason.labelOptional;
  const purchaseDate = isoToLocalDate(values.purchaseDate);

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-5", className)}
      noValidate
    >
      {/* Request type — Reklamacja / Zwrot (AC-01, AC-03) */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={requestTypeId} id={`${requestTypeId}-label`}>
          {pl.form.fields.requestType.label}
        </Label>
        <Select
          value={values.requestType}
          onValueChange={(v) => updateField("requestType", v as RequestType)}
          disabled={disabled}
        >
          <SelectTrigger
            id={requestTypeId}
            aria-invalid={!!errors.requestType || undefined}
            aria-describedby={
              errors.requestType ? `${requestTypeId}-error` : undefined
            }
            aria-labelledby={`${requestTypeId}-label`}
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REQUEST_TYPE_VALUES.map((rt) => (
              <SelectItem key={rt} value={rt}>
                {REQUEST_TYPE_LABELS[rt]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id={`${requestTypeId}-error`} aria-live="polite">
          {errors.requestType}
        </FieldError>
      </div>

      {/* Equipment category — PRD §8 list */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={categoryId} id={`${categoryId}-label`}>
          {pl.form.fields.category.label}
        </Label>
        <Select
          value={values.category}
          onValueChange={(v) => updateField("category", v as Category)}
          disabled={disabled}
        >
          <SelectTrigger
            id={categoryId}
            aria-invalid={!!errors.category || undefined}
            aria-describedby={
              errors.category ? `${categoryId}-error` : undefined
            }
            aria-labelledby={`${categoryId}-label`}
            className="w-full"
          >
            <SelectValue placeholder={pl.form.fields.category.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_VALUES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id={`${categoryId}-error`} aria-live="polite">
          {errors.category}
        </FieldError>
      </div>

      {/* Product name / model — text, 2–100 chars (PRD §8) */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={productNameId}>{pl.form.fields.productName.label}</Label>
        <Input
          id={productNameId}
          type="text"
          autoComplete="off"
          placeholder={pl.form.fields.productName.placeholder}
          value={values.productName}
          disabled={disabled}
          aria-invalid={!!errors.productName || undefined}
          aria-describedby={
            errors.productName ? `${productNameId}-error` : undefined
          }
          onChange={(e) => updateField("productName", e.target.value)}
        />
        <FieldError id={`${productNameId}-error`} aria-live="polite">
          {errors.productName}
        </FieldError>
      </div>

      {/* Purchase date — calendar in a popover; future dates disabled (AC-04) */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={purchaseDateId} id={`${purchaseDateId}-label`}>
          {pl.form.fields.purchaseDate.label}
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={purchaseDateId}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-labelledby={`${purchaseDateId}-label`}
              aria-invalid={!!errors.purchaseDate || undefined}
              aria-describedby={
                errors.purchaseDate ? `${purchaseDateId}-error` : undefined
              }
              className="w-full justify-start font-normal"
            >
              {purchaseDate ? (
                format(purchaseDate, "d MMMM yyyy", { locale: plLocale })
              ) : (
                <span className="text-muted-foreground">
                  {pl.form.fields.purchaseDate.placeholder}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              locale={plLocale}
              selected={purchaseDate}
              onSelect={(date) =>
                updateField("purchaseDate", date ? dateToIso(date) : "")
              }
              disabled={{ after: endOfToday }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
        <FieldError id={`${purchaseDateId}-error`} aria-live="polite">
          {errors.purchaseDate}
        </FieldError>
      </div>

      {/* Reason — textarea, max 2000 chars, required for complaint (AC-03) */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={reasonId} id={`${reasonId}-label`}>
          {reasonLabelText}
        </Label>
        <Textarea
          id={reasonId}
          rows={4}
          placeholder={pl.form.fields.reason.placeholder}
          value={values.reason}
          disabled={disabled}
          maxLength={REASON_MAX_LENGTH}
          aria-labelledby={`${reasonId}-label`}
          aria-invalid={!!errors.reason || undefined}
          aria-describedby={
            errors.reason ? `${reasonId}-error` : `${reasonId}-counter`
          }
          onChange={(e) =>
            updateField(
              "reason",
              e.target.value.slice(0, REASON_MAX_LENGTH),
            )
          }
        />
        <div className="flex items-center justify-between gap-2">
          <FieldError id={`${reasonId}-error`} aria-live="polite">
            {errors.reason}
          </FieldError>
          <span
            id={`${reasonId}-counter`}
            aria-label={pl.common.characterCounterAriaLabel(
              values.reason.length,
              REASON_MAX_LENGTH,
            )}
            className={cn(
              "ml-auto text-sm tabular-nums",
              values.reason.length >= REASON_MAX_LENGTH
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {values.reason.length}/{REASON_MAX_LENGTH}
          </span>
        </div>
      </div>

      {/* Image — placeholder slot until T4.2/T4.3 (AC-01 image area) */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={imageId}>{pl.form.fields.image.label}</Label>
        {imageSlot ?? (
          <div
            id={imageId}
            tabIndex={-1}
            aria-label={pl.form.fields.image.label}
            className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border bg-background-subtle px-4 py-6 text-center text-sm text-muted-foreground"
          >
            <span>{pl.form.fields.image.dropzoneHint}</span>
          </div>
        )}
        <FieldError id={`${imageId}-error`} aria-live="polite">
          {errors.image}
        </FieldError>
      </div>

      {/* Submit — full-width Polish label (PRD §9.1, Play primary action) */}
      <Button
        type="submit"
        disabled={disabled}
        className="w-full bg-brand-primary text-white hover:bg-brand-primary/90"
      >
        {pl.form.submitButton}
      </Button>
    </form>
  );
}
