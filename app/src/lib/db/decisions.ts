/**
 * `decisions` repository (ADR-003 §4/§6).
 *
 * `insertDecision` also maintains `cases.needs_review`: it is set to `1`
 * the first time a decision reaches `needs_human_review` and is NEVER
 * reset back to `0` (ADR-003 §6 "needs_review is a one-way flag") — a
 * later `approved`/`rejected` revision simply does not touch the flag.
 * `is_revision` is derived automatically: `false` for the first decision
 * on a case, `true` for any subsequent one. Throws (FK violation) if
 * `caseId` does not exist.
 */

import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";

export type DecisionStatus = "approved" | "rejected" | "needs_human_review";

export interface Decision {
  id: string;
  caseId: string;
  status: DecisionStatus;
  justification: string;
  nextSteps: string[];
  isRevision: boolean;
  createdAt: string;
}

export interface InsertDecisionInput {
  status: DecisionStatus;
  justification: string;
  nextSteps: string[];
}

interface DecisionRow {
  id: string;
  case_id: string;
  status: DecisionStatus;
  justification: string;
  next_steps_json: string;
  is_revision: number;
  created_at: string;
}

function toDecision(row: DecisionRow): Decision {
  return {
    id: row.id,
    caseId: row.case_id,
    status: row.status,
    justification: row.justification,
    nextSteps: JSON.parse(row.next_steps_json) as string[],
    isRevision: row.is_revision === 1,
    createdAt: row.created_at,
  };
}

export function insertDecision(
  db: Database,
  caseId: string,
  input: InsertDecisionInput,
): Decision {
  const insertTx = db.transaction(() => {
    const { count } = db
      .prepare(`SELECT COUNT(*) as count FROM decisions WHERE case_id = ?`)
      .get(caseId) as { count: number };
    const isRevision = count > 0;

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const nextStepsJson = JSON.stringify(input.nextSteps);

    db.prepare(
      `INSERT INTO decisions (id, case_id, status, justification, next_steps_json, is_revision, created_at)
       VALUES (@id, @caseId, @status, @justification, @nextStepsJson, @isRevision, @createdAt)`,
    ).run({
      id,
      caseId,
      status: input.status,
      justification: input.justification,
      nextStepsJson,
      isRevision: isRevision ? 1 : 0,
      createdAt,
    });

    if (input.status === "needs_human_review") {
      db.prepare(`UPDATE cases SET needs_review = 1, updated_at = ? WHERE id = ?`).run(
        createdAt,
        caseId,
      );
    } else {
      db.prepare(`UPDATE cases SET updated_at = ? WHERE id = ?`).run(createdAt, caseId);
    }

    return { id, createdAt, isRevision };
  });

  const { id, createdAt, isRevision } = insertTx();

  return {
    id,
    caseId,
    status: input.status,
    justification: input.justification,
    nextSteps: input.nextSteps,
    isRevision,
    createdAt,
  };
}

/** Lists all decisions for a case, oldest first. Used internally by `getCaseWithHistory`. */
export function listDecisionsByCaseId(db: Database, caseId: string): Decision[] {
  const rows = db
    .prepare(
      `SELECT * FROM decisions WHERE case_id = ? ORDER BY created_at ASC, rowid ASC`,
    )
    .all(caseId) as DecisionRow[];

  return rows.map(toDecision);
}
