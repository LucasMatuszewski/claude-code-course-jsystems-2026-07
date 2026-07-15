"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { pl } from "@/lib/copy/pl";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  EQUIPMENT_CATEGORIES,
  MAX_IMAGE_SIZE_BYTES,
  REQUEST_TYPES,
  caseFormSchema,
  type EquipmentCategory,
  type RequestType,
} from "@/lib/validation/case-form.schema";
import { ImageUploadField } from "./ImageUploadField";

type FieldKey =
  | "requestType"
  | "category"
  | "productName"
  | "purchaseDate"
  | "description"
  | "image"
  | "form";

type FieldErrors = Partial<Record<FieldKey, string>>;

type Status = "form" | "loading" | "error";

interface ServiceErrorState {
  message: string;
  caseId?: string;
}

/** Shared select-field class so native `<select>` matches the Input/Button look (Play radius/tokens). */
const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isFutureDate(isoDate: string): boolean {
  if (!isoDate) return false;
  const parsed = new Date(`${isoDate}T00:00:00`);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return parsed.getTime() > endOfToday.getTime();
}

function zodIssuesToFieldErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    const field: FieldKey = typeof key === "string" ? (key as FieldKey) : "form";
    if (!errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

/**
 * Request form — start screen (PRD §9.1, AC-01..07). Client-validates with
 * the shared `caseFormSchema` before ever calling `POST /api/cases`
 * (ADR-004 §3/§6), then drives the full-screen loading / service-error
 * states and navigates to the chat page on success.
 */
export function RequestForm() {
  const router = useRouter();

  const [requestType, setRequestType] = useState<RequestType | "">("");
  const [category, setCategory] = useState<EquipmentCategory | "">("");
  const [productName, setProductName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<Status>("form");
  const [serviceError, setServiceError] = useState<ServiceErrorState | null>(null);

  const isComplaint = requestType === "reklamacja";

  function clearFieldError(field: FieldKey) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function markDirty() {
    setDirty(true);
  }

  function handlePurchaseDateChange(value: string) {
    setPurchaseDate(value);
    markDirty();
    if (isFutureDate(value)) {
      setFieldErrors((prev) => ({ ...prev, purchaseDate: pl.form.errors.purchaseDateFuture }));
    } else {
      clearFieldError("purchaseDate");
    }
  }

  function handleImageSelect(file: File | null) {
    markDirty();
    if (!file) {
      setImageFile(null);
      clearFieldError("image");
      return;
    }
    if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      setImageFile(null);
      setFieldErrors((prev) => ({ ...prev, image: pl.form.errors.imageInvalidType }));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageFile(null);
      setFieldErrors((prev) => ({ ...prev, image: pl.form.errors.imageTooLarge }));
      return;
    }
    setImageFile(file);
    clearFieldError("image");
  }

  function validate(): boolean {
    const candidate = {
      requestType: requestType || undefined,
      category: category || undefined,
      productName: productName || undefined,
      purchaseDate: purchaseDate || undefined,
      description: description || undefined,
      image: imageFile ? { mimeType: imageFile.type, sizeBytes: imageFile.size } : undefined,
    };
    const parsed = caseFormSchema.safeParse(candidate);
    if (!parsed.success) {
      setFieldErrors(zodIssuesToFieldErrors(parsed.error.issues));
      return false;
    }
    setFieldErrors({});
    return true;
  }

  async function submitFormData(formData: FormData) {
    setStatus("loading");
    try {
      const response = await fetch("/api/cases", { method: "POST", body: formData });
      const json = await response.json().catch(() => ({}) as Record<string, unknown>);

      if (response.ok) {
        router.push(`/chat/${json.caseId as string}`);
        return;
      }

      if (response.status === 400 && json.fieldErrors) {
        setFieldErrors(json.fieldErrors as FieldErrors);
        setStatus("form");
        return;
      }

      if (response.status === 502) {
        setServiceError({
          message: (json.error as string) ?? pl.form.serviceError.message,
          caseId: json.caseId as string | undefined,
        });
        setStatus("error");
        return;
      }

      setServiceError({ message: pl.errors.genericApi });
      setStatus("error");
    } catch {
      setServiceError({ message: pl.form.serviceError.message });
      setStatus("error");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    const formData = new FormData();
    formData.set("requestType", requestType);
    formData.set("category", category);
    formData.set("productName", productName);
    formData.set("purchaseDate", purchaseDate);
    if (description) formData.set("description", description);
    if (imageFile) formData.set("image", imageFile);

    void submitFormData(formData);
  }

  function handleRetry() {
    const formData = new FormData();
    if (serviceError?.caseId) formData.set("caseId", serviceError.caseId);
    void submitFormData(formData);
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-secondary">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
        <header className="flex flex-col items-center gap-4 text-center">
          <Image src="/logo.svg" alt="" aria-hidden width={100} height={32} priority />
          <div>
            <h1 className="text-2xl font-semibold">{pl.form.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{pl.form.subtitle}</p>
          </div>
        </header>

        <Card>
          <CardContent>
            {status === "loading" ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Spinner className="size-8" />
                <p>{pl.form.loadingText}</p>
              </div>
            ) : status === "error" && serviceError ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <p>{serviceError.message}</p>
                <Button type="button" onClick={handleRetry}>
                  {pl.form.serviceError.retryButton}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label htmlFor="requestType" className="text-sm font-medium">
                    {pl.form.fields.requestType.label}
                  </label>
                  <select
                    id="requestType"
                    className={selectClassName}
                    aria-invalid={Boolean(fieldErrors.requestType)}
                    value={requestType}
                    onChange={(event) => {
                      setRequestType(event.target.value as RequestType);
                      markDirty();
                      clearFieldError("requestType");
                    }}
                  >
                    <option value="" disabled hidden />
                    {REQUEST_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {pl.form.fields.requestType.options[type]}
                      </option>
                    ))}
                  </select>
                  <FieldError message={fieldErrors.requestType} />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="category" className="text-sm font-medium">
                    {pl.form.fields.category.label}
                  </label>
                  <select
                    id="category"
                    className={selectClassName}
                    aria-invalid={Boolean(fieldErrors.category)}
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value as EquipmentCategory);
                      markDirty();
                      clearFieldError("category");
                    }}
                  >
                    <option value="" disabled hidden />
                    {EQUIPMENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {pl.form.fields.category.options[cat]}
                      </option>
                    ))}
                  </select>
                  <FieldError message={fieldErrors.category} />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="productName" className="text-sm font-medium">
                    {pl.form.fields.productName.label}
                  </label>
                  <Input
                    id="productName"
                    type="text"
                    placeholder={pl.form.fields.productName.placeholder}
                    aria-invalid={Boolean(fieldErrors.productName)}
                    value={productName}
                    onChange={(event) => {
                      setProductName(event.target.value);
                      markDirty();
                      clearFieldError("productName");
                    }}
                  />
                  <FieldError message={fieldErrors.productName} />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="purchaseDate" className="text-sm font-medium">
                    {pl.form.fields.purchaseDate.label}
                  </label>
                  <Input
                    id="purchaseDate"
                    type="date"
                    max={todayIso()}
                    aria-invalid={Boolean(fieldErrors.purchaseDate)}
                    value={purchaseDate}
                    onChange={(event) => handlePurchaseDateChange(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {pl.form.fields.purchaseDate.helper}
                  </p>
                  <FieldError message={fieldErrors.purchaseDate} />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="description" className="text-sm font-medium">
                    {isComplaint
                      ? pl.form.fields.description.labelRequired
                      : pl.form.fields.description.labelOptional}
                  </label>
                  <Textarea
                    id="description"
                    aria-invalid={Boolean(fieldErrors.description)}
                    value={description}
                    onChange={(event) => {
                      setDescription(event.target.value);
                      markDirty();
                      clearFieldError("description");
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {isComplaint
                      ? pl.form.fields.description.helperComplaint
                      : pl.form.fields.description.helperReturn}
                  </p>
                  <FieldError message={fieldErrors.description} />
                </div>

                <ImageUploadField
                  inputId="image"
                  file={imageFile}
                  error={fieldErrors.image}
                  onSelect={handleImageSelect}
                />

                <FieldError message={fieldErrors.form} />

                <Button type="submit" disabled={!dirty} className="w-full">
                  {pl.form.submitButton}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
