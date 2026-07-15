import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "@/lib/db/client";
import { createCase, getCaseWithHistory } from "@/lib/db/cases";
import { insertDecision, listDecisionsByCaseId } from "@/lib/db/decisions";

function tempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hsc-db-decisions-"));
  return path.join(dir, "copilot.db");
}

describe("decisions repository", () => {
  let dbPath: string;
  let db: Database.Database;
  let caseId: string;

  beforeEach(() => {
    dbPath = tempDbPath();
    db = createDb(dbPath);
    caseId = createCase(db, {
      requestType: "zwrot",
      category: "elektronika",
      productName: "Słuchawki",
      purchaseDate: "2026-06-10",
      description: null,
    }).id;
  });

  afterEach(() => {
    db.close();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it("marks the first decision on a case as not a revision", () => {
    const decision = insertDecision(db, caseId, {
      status: "approved",
      justification: "Spełnia warunki zwrotu",
      nextSteps: ["Wyślij etykietę"],
    });

    expect(decision.isRevision).toBe(false);
    expect(decision.nextSteps).toEqual(["Wyślij etykietę"]);
  });

  it("marks subsequent decisions on the same case as revisions", () => {
    insertDecision(db, caseId, {
      status: "needs_human_review",
      justification: "Niejasne",
      nextSteps: [],
    });
    const second = insertDecision(db, caseId, {
      status: "approved",
      justification: "Rozstrzygnięto",
      nextSteps: [],
    });

    expect(second.isRevision).toBe(true);
  });

  it("sets cases.needs_review = 1 when a decision reaches needs_human_review (TAC-003-02)", () => {
    insertDecision(db, caseId, {
      status: "needs_human_review",
      justification: "Niejasne",
      nextSteps: [],
    });

    const detail = getCaseWithHistory(db, caseId);
    expect(detail!.needsReview).toBe(true);
  });

  it("never resets needs_review to 0 once set, even after approved/rejected revisions (TAC-003-02)", () => {
    insertDecision(db, caseId, {
      status: "needs_human_review",
      justification: "Niejasne",
      nextSteps: [],
    });
    insertDecision(db, caseId, {
      status: "approved",
      justification: "Rozstrzygnięto",
      nextSteps: [],
    });
    insertDecision(db, caseId, {
      status: "rejected",
      justification: "Zmiana decyzji",
      nextSteps: [],
    });

    const detail = getCaseWithHistory(db, caseId);
    expect(detail!.needsReview).toBe(true);
    expect(detail!.decisions).toHaveLength(3);
  });

  it("does not set needs_review for a case whose decisions never reach needs_human_review", () => {
    insertDecision(db, caseId, {
      status: "approved",
      justification: "Od razu zatwierdzono",
      nextSteps: [],
    });

    const detail = getCaseWithHistory(db, caseId);
    expect(detail!.needsReview).toBe(false);
  });

  it("lists decisions for a case ordered by created_at ascending", () => {
    const first = insertDecision(db, caseId, {
      status: "needs_human_review",
      justification: "a",
      nextSteps: [],
    });
    const second = insertDecision(db, caseId, {
      status: "approved",
      justification: "b",
      nextSteps: [],
    });

    const decisions = listDecisionsByCaseId(db, caseId);
    expect(decisions.map((d) => d.id)).toEqual([first.id, second.id]);
  });

  it("throws (FK violation) when the case does not exist", () => {
    expect(() =>
      insertDecision(db, "missing-case", {
        status: "approved",
        justification: "x",
        nextSteps: [],
      }),
    ).toThrow();
  });
});
