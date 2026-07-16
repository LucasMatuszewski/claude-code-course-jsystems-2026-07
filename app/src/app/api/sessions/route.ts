import { nanoid } from "nanoid";

import { getDb } from "@/lib/db/client";
import {
  createSession,
  type SessionImageMeta,
  type ValidatedSessionForm,
} from "@/lib/db/repositories";
import { compressImage, storeImage } from "@/lib/images";
import { getFieldErrors, requestFormSchema } from "@/lib/validation";

/**
 * POST /api/sessions (ADR-000 section 6).
 *
 * Accepts a `multipart/form-data` submission, validates it server-side with
 * the shared Zod schema (mirrors the client rules AC-01..AC-05), compresses
 * the uploaded image, persists a new session row, and responds `201
 * { sessionId }`. No AI call happens here — the analyze step is a separate
 * endpoint so it can be retried independently (AC-28).
 *
 * Oversized or wrong-type files collapse to a field-keyed 400 (AC-05), never
 * a 500. The original upload bytes are never persisted: only the sharp
 * re-encoded JPEG is written (AC-08 / TAC-06).
 *
 * Design note on the image filename: `createSession` generates the session id
 * internally and its signature requires `imageMeta.imagePath` as input, so
 * the path cannot be derived from `session.id`. The image is therefore
 * stored under a handler-generated nanoid and the resulting relative path is
 * what `createSession` persists. `session.imagePath` (the DB column) is the
 * authoritative location of the file — consumers must read it from the row
 * rather than reconstructing the path from `session.id`.
 */
export async function POST(request: Request): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    // Malformed body (not valid multipart) — surface as a root-level error.
    return Response.json(
      { errors: { _root: "Nie udało się odczytać danych formularza." } },
      { status: 400 },
    );
  }

  const file = formData.get("image");
  const imageInput =
    file !== null &&
    typeof file === "object" &&
    "type" in file &&
    "size" in file
      ? {
          type: (file as { type: string }).type,
          size: (file as { size: number }).size,
        }
      : undefined;

  const parsed = requestFormSchema.safeParse({
    requestType: stringValue(formData.get("requestType")),
    category: stringValue(formData.get("category")),
    productName: stringValue(formData.get("productName")),
    purchaseDate: stringValue(formData.get("purchaseDate")),
    reason: stringValue(formData.get("reason")),
    image: imageInput,
  });

  if (!parsed.success) {
    return Response.json({ errors: getFieldErrors(parsed.error) }, { status: 400 });
  }

  const validated = parsed.data;

  // Validation guarantees an image is present; the original File reference is
  // needed to read bytes and the uploaded filename. Guard for type safety.
  if (
    file === null ||
    typeof (file as { arrayBuffer?: unknown }).arrayBuffer !== "function"
  ) {
    throw new Error("Image file missing after successful validation (invariant).");
  }
  const imageFile = file as File;

  // Read the upload, compress it, and persist only the compressed JPEG.
  const originalBytes = Buffer.from(await imageFile.arrayBuffer());
  const compressed = await compressImage(originalBytes);

  const imageFileId = nanoid();
  const imagePath = await storeImage(imageFileId, compressed);

  const form: ValidatedSessionForm = {
    requestType: validated.requestType,
    category: validated.category,
    productName: validated.productName,
    purchaseDate: validated.purchaseDate,
    reason: validated.reason ?? null,
  };
  const imageMeta: SessionImageMeta = {
    imagePath,
    imageOriginalName: imageFile.name,
    // ADR-003 section 3: store the media type AS UPLOADED (e.g. image/png),
    // not the compressed output format (image/jpeg).
    imageMediaType: validated.image.type,
  };

  const session = createSession(getDb(), form, imageMeta);

  return Response.json({ sessionId: session.id }, { status: 201 });
}

/** Normalizes a FormData entry to a string or undefined (never null, never File). */
function stringValue(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}
