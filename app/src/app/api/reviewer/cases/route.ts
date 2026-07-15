/**
 * `GET /api/reviewer/cases` — list escalated cases for the reviewer view
 * (ADR-000 §6 "GET /api/reviewer/cases"; PRD AC-40/41).
 *
 * Returns every case with `needs_review = 1` (set one-way by
 * `insertDecision` when a decision reaches `needs_human_review`, see
 * `lib/db/decisions.ts`), newest first. No input, no auth (MVP, PRD §7 Out
 * of Scope) — the reviewer detail page reuses `GET /api/cases/[caseId]`.
 *
 * ## Testability
 * `createReviewerCasesGetHandler(deps)` is the dependency-injected seam
 * (same pattern as `POST /api/cases`): integration tests inject a temp
 * SQLite handle. The exported `GET` wires the production `getDb()`.
 */

import type Database from "better-sqlite3";

import { getDb } from "@/lib/db/client";
import { listEscalatedCases } from "@/lib/db/cases";

export interface ReviewerCasesGetDeps {
  db: Database.Database;
}

export interface ReviewerCaseSummary {
  caseId: string;
  caseNumber: string;
  createdAt: string;
  requestType: string;
  category: string;
  productName: string;
}

/** DI factory: builds the `GET` handler from injectable dependencies. */
export function createReviewerCasesGetHandler(deps: ReviewerCasesGetDeps) {
  return async function GET(): Promise<Response> {
    const escalated = listEscalatedCases(deps.db);

    const cases: ReviewerCaseSummary[] = escalated.map((caseSummary) => ({
      caseId: caseSummary.id,
      caseNumber: caseSummary.caseNumber,
      createdAt: caseSummary.createdAt,
      requestType: caseSummary.requestType,
      category: caseSummary.category,
      productName: caseSummary.productName,
    }));

    return Response.json({ cases }, { status: 200 });
  };
}

/** Production handler: wires the shared DB connection. */
export async function GET(): Promise<Response> {
  return createReviewerCasesGetHandler({ db: getDb() })();
}
