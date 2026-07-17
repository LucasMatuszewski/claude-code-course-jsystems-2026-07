import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOADS_RELATIVE_DIR = path.join("data", "uploads");

/** URL-safe session IDs only (nanoid alphabet); guards against path traversal. */
const SAFE_SESSION_ID = /^[A-Za-z0-9_-]+$/;

function assertSafeSessionId(sessionId: string): void {
  if (!SAFE_SESSION_ID.test(sessionId)) {
    throw new Error(`Invalid sessionId for image path: ${sessionId}`);
  }
}

/**
 * Relative path (from the app root) of the stored image for a session, per
 * ADR-003: `data/uploads/{sessionId}.jpg`. Does not touch the filesystem.
 */
export function getImagePath(sessionId: string): string {
  assertSafeSessionId(sessionId);
  return path.join(UPLOADS_RELATIVE_DIR, `${sessionId}.jpg`);
}

/**
 * Writes an already-compressed image buffer to `data/uploads/{sessionId}.jpg`
 * and returns the relative path (as stored on the `sessions.imagePath`
 * column, ADR-003 §3).
 *
 * `baseDir` defaults to `process.cwd()` (the app root at runtime) and is
 * only overridden in tests, so production callers never need to pass it.
 */
export async function storeImage(
  sessionId: string,
  compressedBuffer: Buffer,
  baseDir: string = process.cwd(),
): Promise<string> {
  const relativePath = getImagePath(sessionId);
  const absolutePath = path.join(baseDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, compressedBuffer);
  return relativePath;
}

/**
 * Reads a previously stored image back from disk (e.g. for the vision
 * call). `relativePath` is the value returned by `storeImage` /
 * `getImagePath`.
 */
export async function readImage(
  relativePath: string,
  baseDir: string = process.cwd(),
): Promise<Buffer> {
  return readFile(path.join(baseDir, relativePath));
}
