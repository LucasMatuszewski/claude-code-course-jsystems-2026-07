/**
 * `case_images` repository (ADR-003 §4).
 *
 * Stores a reference to a compressed image on disk (the actual file write
 * is `lib/images/storage.ts`'s job, out of scope here). Inserting an image
 * for a nonexistent case throws a foreign-key violation, per ADR-003 §5/§6.
 */

import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";

export type CaseImageSource = "form" | "chat_reupload";

export interface CaseImage {
  id: string;
  caseId: string;
  filePath: string;
  source: CaseImageSource;
  originalFilename: string;
  mimeType: string;
  createdAt: string;
}

export interface InsertCaseImageInput {
  filePath: string;
  source: CaseImageSource;
  originalFilename: string;
  mimeType: string;
}

interface CaseImageRow {
  id: string;
  case_id: string;
  file_path: string;
  source: CaseImageSource;
  original_filename: string;
  mime_type: string;
  created_at: string;
}

function toCaseImage(row: CaseImageRow): CaseImage {
  return {
    id: row.id,
    caseId: row.case_id,
    filePath: row.file_path,
    source: row.source,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  };
}

/** Inserts a case image row. Throws (FK violation) if `caseId` does not exist. */
export function insertCaseImage(
  db: Database,
  caseId: string,
  input: InsertCaseImageInput,
): CaseImage {
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO case_images (id, case_id, file_path, source, original_filename, mime_type, created_at)
     VALUES (@id, @caseId, @filePath, @source, @originalFilename, @mimeType, @createdAt)`,
  ).run({
    id,
    caseId,
    filePath: input.filePath,
    source: input.source,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    createdAt,
  });

  return {
    id,
    caseId,
    filePath: input.filePath,
    source: input.source,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    createdAt,
  };
}

/** Lists all images for a case, oldest first. Used internally by `getCaseWithHistory`. */
export function listCaseImagesByCaseId(db: Database, caseId: string): CaseImage[] {
  const rows = db
    .prepare(
      `SELECT * FROM case_images WHERE case_id = ? ORDER BY created_at ASC, rowid ASC`,
    )
    .all(caseId) as CaseImageRow[];

  return rows.map(toCaseImage);
}
