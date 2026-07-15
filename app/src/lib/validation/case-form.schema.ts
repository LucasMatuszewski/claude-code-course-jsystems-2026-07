/**
 * Shared, isomorphic Zod schema for the request form (PRD §6 AC-01..AC-06).
 * Imported by both the client form component and the `POST /api/cases`
 * handler (ADR-004 §3/§6 "Shared Zod schema between client and server form
 * validation") — one source of truth for validation rules and error
 * messages, all of which come from `lib/copy/pl.ts` (no inline literals).
 *
 * The image itself is validated as metadata `{ mimeType, sizeBytes }`
 * rather than a `File`/`Blob` instance so the exact same schema works in
 * the browser (client-side pre-check, AC-05) and on the server (after the
 * upload has already been read into a buffer).
 */

import { z } from "zod";
import { pl } from "@/lib/copy/pl";

export const REQUEST_TYPES = ["zwrot", "reklamacja"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const EQUIPMENT_CATEGORIES = [
  "Smartfon",
  "Laptop",
  "Tablet",
  "Telewizor",
  "Słuchawki",
  "Monitor",
  "Inne",
] as const;
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** AC-05: images over 10 MB are rejected. */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Image validated as metadata only (AC-05): exactly one file, JPG/PNG/WebP,
 * up to 10 MB. Works identically for a browser `File` (caller extracts
 * `{ type, size }`) and for a server-side buffer read from the request.
 */
export const imageMetadataSchema = z.object(
  {
    mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES, {
      error: () => pl.form.errors.imageInvalidType,
    }),
    sizeBytes: z
      .number({ error: () => pl.form.errors.imageTooLarge })
      .max(MAX_IMAGE_SIZE_BYTES, { error: () => pl.form.errors.imageTooLarge }),
  },
  { error: () => pl.form.errors.imageRequired },
);

export type ImageMetadata = z.infer<typeof imageMetadataSchema>;

/** AC-04: purchase date cannot be in the future (compared at day granularity). */
function isNotFutureDate(isoDate: string): boolean {
  const parsed = new Date(`${isoDate}T00:00:00`);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return parsed.getTime() <= endOfToday.getTime();
}

export const caseFormSchema = z
  .object({
    requestType: z.enum(REQUEST_TYPES, {
      error: () => pl.form.errors.requestTypeRequired,
    }),
    category: z.enum(EQUIPMENT_CATEGORIES, {
      error: () => pl.form.errors.categoryRequired,
    }),
    productName: z
      .string({ error: () => pl.form.errors.productNameRequired })
      .min(1, { error: () => pl.form.errors.productNameRequired }),
    purchaseDate: z
      .iso.date({ error: () => pl.form.errors.purchaseDateInvalid })
      .refine(isNotFutureDate, { error: () => pl.form.errors.purchaseDateFuture }),
    // Required only for "reklamacja" (AC-03) — enforced below via superRefine
    // since it depends on the sibling `requestType` field.
    description: z.string().optional(),
    image: imageMetadataSchema,
  })
  .superRefine((data, ctx) => {
    if (data.requestType === "reklamacja" && !data.description?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: pl.form.errors.descriptionRequiredForComplaint,
      });
    }
  });

export type CaseFormValues = z.infer<typeof caseFormSchema>;
