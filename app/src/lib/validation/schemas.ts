import * as z from "zod";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  CATEGORY_VALUES,
  CHAT_MESSAGE_MAX_LENGTH,
  MAX_IMAGE_SIZE_BYTES,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_NAME_MIN_LENGTH,
  REASON_MAX_LENGTH,
  REQUEST_TYPE_VALUES,
  type AllowedImageMimeType,
} from "./constants";
import { VALIDATION_MESSAGES_PL } from "./messages";

const M = VALIDATION_MESSAGES_PL;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Today's date as a local YYYY-MM-DD string. Uses local time (not UTC) so
 * it matches what a customer's date picker considers "today" (PRD 9.1:
 * "dates after today disabled").
 */
export function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// --- Individual field schemas -------------------------------------------
//
// Design note: every field schema sets its *constructor-level* `error` only
// to handle `invalid_type` issues (missing value / wrong JS type) — that is
// the one issue code a constructor-level error can own without colliding
// with Zod v4's error-map precedence rules for check-level errors. Every
// other validation rule (length, format, business rules) is expressed as a
// `superRefine` emitting a `custom` issue with an explicit message. This
// keeps each message 1:1 with an explicit rule and avoids ambiguity about
// which error map wins (see ADR-000 Context7 note on Zod v4 API changes).

export const requestTypeSchema = z.enum(REQUEST_TYPE_VALUES, {
  error: () => M.requestTypeRequired,
});

export const categorySchema = z.enum(CATEGORY_VALUES, {
  error: () => M.categoryRequired,
});

export const productNameSchema = z
  .string({ error: () => M.productNameRequired })
  .trim()
  .superRefine((value, ctx) => {
    if (value.length === 0) {
      ctx.addIssue({ code: "custom", message: M.productNameRequired });
      return;
    }
    if (value.length < PRODUCT_NAME_MIN_LENGTH || value.length > PRODUCT_NAME_MAX_LENGTH) {
      ctx.addIssue({ code: "custom", message: M.productNameLength });
    }
  });

export const purchaseDateSchema = z
  .string({ error: () => M.purchaseDateRequired })
  .superRefine((value, ctx) => {
    if (!ISO_DATE_PATTERN.test(value)) {
      ctx.addIssue({ code: "custom", message: M.purchaseDateInvalid });
      return;
    }
    if (value > todayIsoDate()) {
      ctx.addIssue({ code: "custom", message: M.purchaseDateFuture });
    }
  });

/**
 * The reason/description field is optional at the schema level — whether it
 * is *required* depends on request type and is enforced by `requestFormSchema`
 * with a cross-field refinement (AC-03). Here we only enforce the max length
 * (PRD §8) when a value is present.
 */
export const reasonSchema = z
  .string()
  .max(REASON_MAX_LENGTH, { error: M.reasonTooLong })
  .optional();

/**
 * Structural metadata for the uploaded file (`type` = MIME type, `size` in
 * bytes). Deliberately not `instanceof File` — a plain `{ type, size }`
 * shape is satisfied by a browser `File`/`Blob` (via property access), by
 * multipart-parsed server-side file metadata, and by plain test fixtures,
 * without cross-realm `instanceof` pitfalls (AC-05, AC-06).
 *
 * Implemented with `z.custom` + a single `superRefine` (rather than
 * `z.object({ type, size })`) so every failure — missing file, malformed
 * shape, wrong MIME type, oversized file — collapses to one Polish message
 * at the field's own path, instead of leaking Zod's default English
 * messages through nested per-property issues.
 */
export interface ImageFileMeta {
  type: string;
  size: number;
}

function isFileLikeShape(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export const imageFileMetaSchema = z
  .custom<ImageFileMeta>(isFileLikeShape, { error: () => M.imageRequired })
  .superRefine((value, ctx) => {
    const type = typeof value.type === "string" ? value.type : "";
    const size = typeof value.size === "number" ? value.size : Number.POSITIVE_INFINITY;
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(type as AllowedImageMimeType) || size > MAX_IMAGE_SIZE_BYTES) {
      ctx.addIssue({ code: "custom", message: M.imageInvalid });
    }
  });

// --- Chat message ---------------------------------------------------------

export const chatMessageSchema = z
  .string({ error: () => M.chatMessageRequired })
  .superRefine((value, ctx) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      ctx.addIssue({ code: "custom", message: M.chatMessageRequired });
      return;
    }
    if (value.length > CHAT_MESSAGE_MAX_LENGTH) {
      ctx.addIssue({ code: "custom", message: M.chatMessageTooLong });
    }
  });

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

// --- Full request form (AC-01..AC-07) -------------------------------------

const requestFormBaseSchema = z.object({
  requestType: requestTypeSchema,
  category: categorySchema,
  productName: productNameSchema,
  purchaseDate: purchaseDateSchema,
  reason: reasonSchema,
  image: imageFileMetaSchema,
});

const reasonRequiredDependencySchema = requestFormBaseSchema.pick({
  requestType: true,
  reason: true,
});

export const requestFormSchema = requestFormBaseSchema.refine(
  (data) => {
    if (data.requestType !== "complaint") return true;
    const reason = data.reason?.trim() ?? "";
    return reason.length > 0;
  },
  {
    path: ["reason"],
    message: M.reasonRequiredForComplaint,
    when(payload) {
      return reasonRequiredDependencySchema.safeParse(payload.value).success;
    },
  },
);

export type RequestFormInput = z.infer<typeof requestFormSchema>;

// --- Shared error formatting (TAC-002-01) ---------------------------------

/**
 * Reduces a ZodError to one first Polish message per top-level field path,
 * the shape both the client form (field-level errors under each input) and
 * the server route handlers (400 field-keyed error body, ADR-000 §6) need.
 */
export function getFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    if (!(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}
