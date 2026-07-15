/**
 * `GET /api/images/[...path]` — protected image serving route (ADR-003 §3,
 * §6, TAC-003-05).
 *
 * Images live under `app/uploads/` (outside `public/`, per ADR-003 §6 —
 * customer photos must not be served unauthenticated by Next.js's static
 * file serving). This route is the single place that reads them back off
 * disk. The URL shape mirrors the `relativePath` `lib/images/storage.ts`
 * returns and `case_images.file_path` stores, e.g.
 * `/api/images/uploads/<caseId>/<seq>.jpg`.
 *
 * Every stored file is JPEG (`compressImage` always re-encodes to JPEG —
 * see `project_hsc_image_storage` agent memory), so `Content-Type` is
 * always `image/jpeg`.
 *
 * ## Path traversal (TAC-003-05)
 * The catch-all `path` segments are joined with `/` (never via `path.join`,
 * which would silently normalize away `..` segments before the check runs)
 * and handed to `readCaseImage`, which rejects any `..` segment and verifies
 * the resolved path stays inside the uploads base dir. Any segment that is
 * exactly `..` is also rejected up front as defense in depth. Both a
 * detected traversal attempt and a read failure return a response with an
 * EMPTY body — never file contents, never a leaked error message — so a 400
 * (bad path) and a 404 (missing file) both fail closed.
 *
 * ## Testability
 * `createImagesGetHandler(deps)` is the dependency-injected seam, matching
 * the pattern established by `POST /api/cases` (P2.1): integration tests
 * inject a temp uploads dir; the exported `GET` wires the production
 * default uploads directory.
 */

import { readCaseImage } from "@/lib/images/storage";

export interface ImagesGetDeps {
  /** Uploads root; defaults to `lib/images/storage`'s `app/uploads/`. */
  uploadsBaseDir?: string;
}

type RouteContext = { params: Promise<{ path: string[] }> };

const JPEG_CONTENT_TYPE = "image/jpeg";

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

/** DI factory: builds the `GET` handler from injectable dependencies. */
export function createImagesGetHandler(deps: ImagesGetDeps = {}) {
  return async function GET(_request: Request, context: RouteContext): Promise<Response> {
    const { path: segments } = await context.params;

    if (!segments || segments.length === 0) {
      return emptyResponse(400);
    }
    if (segments.some((segment) => segment === "..")) {
      return emptyResponse(400);
    }

    const relativePath = segments.join("/");

    let buffer: Buffer;
    try {
      buffer = readCaseImage(relativePath, deps.uploadsBaseDir);
    } catch (error) {
      if (isEnoent(error)) {
        return emptyResponse(404);
      }
      // Traversal rejection (or any other read error) — fail closed, no body.
      return emptyResponse(400);
    }

    // `Response` wants a `BodyInit`-typed `ArrayBuffer`-backed view; `Buffer`
    // is typed as `Buffer<ArrayBufferLike>`, which TS doesn't accept directly.
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: { "Content-Type": JPEG_CONTENT_TYPE },
    });
  };
}

/** Production handler: wires the default uploads directory. */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return createImagesGetHandler({})(request, context);
}
