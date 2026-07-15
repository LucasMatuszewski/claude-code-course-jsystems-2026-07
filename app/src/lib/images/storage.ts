/**
 * Case image storage (ADR-003 §3, §6): writes compressed image buffers to
 * `uploads/<caseId>/<sequence>.jpg` and hands back the relative path that
 * gets stored in `case_images.file_path`. Images live outside `public/`
 * (ADR-003 §6 — customer photos must not be served unauthenticated), so
 * read-back always goes through `readCaseImage`, never direct static
 * serving.
 *
 * The base directory is injectable (`baseDir` parameter) so tests can point
 * at a temp directory instead of the real `app/uploads/`. Regardless of
 * `baseDir`, returned relative paths always use the logical `uploads/`
 * prefix (matching ADR-003's "relative path, app-root-relative" contract);
 * `readCaseImage` accepts that shape back and strips the prefix before
 * resolving against `baseDir`.
 */

import fs from "node:fs";
import path from "node:path";

const UPLOADS_ROOT_SEGMENT = "uploads";

/** Default on-disk uploads root, relative to the `app/` working directory. */
export const DEFAULT_UPLOADS_DIR = path.join(process.cwd(), UPLOADS_ROOT_SEGMENT);

export interface StoredImage {
  /** POSIX-style path shaped like `uploads/<caseId>/<seq>.jpg`, stored in the DB. */
  relativePath: string;
  /** Actual on-disk location the bytes were written to. */
  absolutePath: string;
}

function assertSafePathSegment(segment: string, label: string): void {
  if (segment.length === 0 || segment === "." || segment === "..") {
    throw new Error(`Invalid ${label}: "${segment}"`);
  }
}

/**
 * Scans `caseDir` for existing `<n>.jpg` files and returns the next
 * sequence number (1 if the directory is empty or doesn't exist yet).
 */
function nextSequence(caseDir: string): number {
  if (!fs.existsSync(caseDir)) {
    return 1;
  }

  const existingSequences = fs
    .readdirSync(caseDir)
    .map((name) => /^(\d+)\.jpg$/.exec(name))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]));

  return existingSequences.length > 0 ? Math.max(...existingSequences) + 1 : 1;
}

/**
 * Writes `buffer` (expected to already be compressed, see `compress.ts`) to
 * `<baseDir>/<caseId>/<seq>.jpg`, creating the case directory if needed.
 * Sequence numbers increase per case (based on existing files on disk).
 */
export function writeCaseImage(
  caseId: string,
  buffer: Buffer,
  baseDir: string = DEFAULT_UPLOADS_DIR,
): StoredImage {
  assertSafePathSegment(caseId, "caseId");

  const caseDir = path.join(baseDir, caseId);
  fs.mkdirSync(caseDir, { recursive: true });

  const seq = nextSequence(caseDir);
  const fileName = `${seq}.jpg`;
  const absolutePath = path.join(caseDir, fileName);
  fs.writeFileSync(absolutePath, buffer);

  const relativePath = path.posix.join(UPLOADS_ROOT_SEGMENT, caseId, fileName);
  return { relativePath, absolutePath };
}

/**
 * Reads back the bytes for a previously-written `relativePath` (as returned
 * by `writeCaseImage`). Throws — never returns file contents — if the path
 * contains a `..` segment or resolves outside `baseDir` (TAC-003-05
 * groundwork: path traversal protection for the future image Route
 * Handler).
 */
export function readCaseImage(relativePath: string, baseDir: string = DEFAULT_UPLOADS_DIR): Buffer {
  const segments = relativePath.split(/[\\/]+/).filter((segment) => segment.length > 0);

  if (segments.some((segment) => segment === "..")) {
    throw new Error(`Refusing to read path outside uploads dir: "${relativePath}"`);
  }

  const withoutRootPrefix = segments[0] === UPLOADS_ROOT_SEGMENT ? segments.slice(1) : segments;

  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, ...withoutRootPrefix);

  const isInsideBase =
    resolvedTarget === resolvedBase || resolvedTarget.startsWith(resolvedBase + path.sep);

  if (!isInsideBase) {
    throw new Error(`Refusing to read path outside uploads dir: "${relativePath}"`);
  }

  return fs.readFileSync(resolvedTarget);
}
