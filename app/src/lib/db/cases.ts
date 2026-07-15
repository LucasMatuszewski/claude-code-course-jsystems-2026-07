/**
 * `cases` repository (ADR-003 §4/§5/§6).
 *
 * Owns case creation (with a collision-safe `case_number`), the escalated
 * cases list for the reviewer view (`needs_review = 1`, newest first), and
 * `getCaseWithHistory`, which joins in every related table ordered by
 * `created_at` to power both the case detail API route and the reviewer
 * detail page.
 */

import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { listCaseImagesByCaseId, type CaseImage } from "./case-images";
import { listImageAnalysesByCaseId, type ImageAnalysis } from "./image-analyses";
import { listDecisionsByCaseId, type Decision } from "./decisions";
import { listChatMessagesByCaseId, type ChatMessage } from "./chat-messages";

export type RequestType = "zwrot" | "reklamacja";

export interface Case {
  id: string;
  caseNumber: string;
  requestType: RequestType;
  category: string;
  productName: string;
  purchaseDate: string;
  description: string | null;
  needsReview: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CaseSummary = Case;

export interface CaseDetail extends Case {
  images: CaseImage[];
  analyses: ImageAnalysis[];
  decisions: Decision[];
  messages: ChatMessage[];
}

export interface CreateCaseInput {
  requestType: RequestType;
  category: string;
  productName: string;
  purchaseDate: string;
  description?: string | null;
}

interface CaseRow {
  id: string;
  case_number: string;
  request_type: RequestType;
  category: string;
  product_name: string;
  purchase_date: string;
  description: string | null;
  needs_review: number;
  created_at: string;
  updated_at: string;
}

function toCase(row: CaseRow): Case {
  return {
    id: row.id,
    caseNumber: row.case_number,
    requestType: row.request_type,
    category: row.category,
    productName: row.product_name,
    purchaseDate: row.purchase_date,
    description: row.description,
    needsReview: row.needs_review === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatDateYYYYMMDD(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Computes the next sequential `case_number` for the given day
 * (`HSC-YYYYMMDD-NNNN`). Must be called from within the same
 * `db.transaction` as the insert to stay collision-safe.
 */
function nextCaseNumber(db: Database, dateStr: string): string {
  const prefix = `HSC-${dateStr}-`;
  const { count } = db
    .prepare(`SELECT COUNT(*) as count FROM cases WHERE case_number LIKE ?`)
    .get(`${prefix}%`) as { count: number };
  const sequence = count + 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

/** Creates a case with a unique, collision-safe `case_number`. */
export function createCase(db: Database, input: CreateCaseInput): Case {
  const createTx = db.transaction(() => {
    const now = new Date();
    const isoNow = now.toISOString();
    const caseNumber = nextCaseNumber(db, formatDateYYYYMMDD(now));
    const id = randomUUID();
    const description = input.description ?? null;

    db.prepare(
      `INSERT INTO cases (id, case_number, request_type, category, product_name, purchase_date, description, needs_review, created_at, updated_at)
       VALUES (@id, @caseNumber, @requestType, @category, @productName, @purchaseDate, @description, 0, @createdAt, @updatedAt)`,
    ).run({
      id,
      caseNumber,
      requestType: input.requestType,
      category: input.category,
      productName: input.productName,
      purchaseDate: input.purchaseDate,
      description,
      createdAt: isoNow,
      updatedAt: isoNow,
    });

    return { id, caseNumber, isoNow, description };
  });

  const { id, caseNumber, isoNow, description } = createTx();

  return {
    id,
    caseNumber,
    requestType: input.requestType,
    category: input.category,
    productName: input.productName,
    purchaseDate: input.purchaseDate,
    description,
    needsReview: false,
    createdAt: isoNow,
    updatedAt: isoNow,
  };
}

function getCaseById(db: Database, caseId: string): Case | null {
  const row = db.prepare(`SELECT * FROM cases WHERE id = ?`).get(caseId) as
    | CaseRow
    | undefined;
  return row ? toCase(row) : null;
}

/**
 * Returns the case with all related rows (images, analyses, decisions,
 * messages), each ordered by `created_at`. Returns `null` if the case does
 * not exist.
 */
export function getCaseWithHistory(db: Database, caseId: string): CaseDetail | null {
  const caseRow = getCaseById(db, caseId);
  if (!caseRow) {
    return null;
  }

  return {
    ...caseRow,
    images: listCaseImagesByCaseId(db, caseId),
    analyses: listImageAnalysesByCaseId(db, caseId),
    decisions: listDecisionsByCaseId(db, caseId),
    messages: listChatMessagesByCaseId(db, caseId),
  };
}

/** Cases where `needs_review = 1`, ordered newest first (ADR-003 TAC-003-03). */
export function listEscalatedCases(db: Database): CaseSummary[] {
  const rows = db
    .prepare(
      `SELECT * FROM cases WHERE needs_review = 1 ORDER BY created_at DESC, rowid DESC`,
    )
    .all() as CaseRow[];

  return rows.map(toCase);
}
