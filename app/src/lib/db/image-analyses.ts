/**
 * `image_analyses` repository (ADR-003 §4).
 *
 * `analysis` is stored as JSON text (the full `ImageAnalysisSchema` result,
 * owned by the AI layer — ADR-002); this module treats it as an opaque
 * JSON-serializable value and round-trips it via `JSON.stringify`/`parse`.
 * Inserting for a nonexistent case or case image throws (FK violation).
 */

import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface ImageAnalysis {
  id: string;
  caseId: string;
  caseImageId: string;
  conclusive: boolean;
  analysis: unknown;
  createdAt: string;
}

export interface InsertImageAnalysisInput {
  conclusive: boolean;
  analysis: unknown;
}

interface ImageAnalysisRow {
  id: string;
  case_id: string;
  case_image_id: string;
  conclusive: number;
  analysis_json: string;
  created_at: string;
}

function toImageAnalysis(row: ImageAnalysisRow): ImageAnalysis {
  return {
    id: row.id,
    caseId: row.case_id,
    caseImageId: row.case_image_id,
    conclusive: row.conclusive === 1,
    analysis: JSON.parse(row.analysis_json) as unknown,
    createdAt: row.created_at,
  };
}

/**
 * Inserts an image analysis row. Throws (FK violation) if `caseId` or
 * `caseImageId` do not exist.
 */
export function insertImageAnalysis(
  db: Database,
  caseId: string,
  caseImageId: string,
  input: InsertImageAnalysisInput,
): ImageAnalysis {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const analysisJson = JSON.stringify(input.analysis);

  db.prepare(
    `INSERT INTO image_analyses (id, case_id, case_image_id, conclusive, analysis_json, created_at)
     VALUES (@id, @caseId, @caseImageId, @conclusive, @analysisJson, @createdAt)`,
  ).run({
    id,
    caseId,
    caseImageId,
    conclusive: input.conclusive ? 1 : 0,
    analysisJson,
    createdAt,
  });

  return {
    id,
    caseId,
    caseImageId,
    conclusive: input.conclusive,
    analysis: input.analysis,
    createdAt,
  };
}

/** Lists all analyses for a case, oldest first. Used internally by `getCaseWithHistory`. */
export function listImageAnalysesByCaseId(db: Database, caseId: string): ImageAnalysis[] {
  const rows = db
    .prepare(
      `SELECT * FROM image_analyses WHERE case_id = ? ORDER BY created_at ASC, rowid ASC`,
    )
    .all(caseId) as ImageAnalysisRow[];

  return rows.map(toImageAnalysis);
}
