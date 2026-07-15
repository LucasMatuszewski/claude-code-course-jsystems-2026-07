// @vitest-environment node

/**
 * Integration tests for `GET /api/reviewer/cases` (ADR-000 §6; PRD AC-40/41).
 *
 * Real temp SQLite file, exercised through the dependency-injected factory
 * `createReviewerCasesGetHandler`. Cases and decisions are seeded via the
 * real `lib/db/cases` and `lib/db/decisions` repos (not raw SQL) so the
 * `needs_review` flag is set exactly the way production code sets it.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createReviewerCasesGetHandler } from "@/app/api/reviewer/cases/route";
import { createDb } from "@/lib/db/client";
import { createCase, type CreateCaseInput } from "@/lib/db/cases";
import { insertDecision } from "@/lib/db/decisions";

let db: Database.Database;
let dbPath: string;

beforeEach(() => {
  dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "hsc-reviewer-")), "test.db");
  db = createDb(dbPath);
});

afterEach(() => {
  db.close();
  fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
});

const baseCaseInput: CreateCaseInput = {
  requestType: "zwrot",
  category: "Słuchawki",
  productName: "Sony WH-1000XM5",
  purchaseDate: "2025-06-01",
  description: null,
};

function callHandler(): Promise<Response> {
  return createReviewerCasesGetHandler({ db })();
}

describe("GET /api/reviewer/cases", () => {
  it("returns 200 with an empty list when there are no escalations", async () => {
    // A non-escalated case exists, but must not appear in the response.
    const created = createCase(db, baseCaseInput);
    insertDecision(db, created.id, {
      status: "approved",
      justification: "Zgodnie z zasadami.",
      nextSteps: ["Krok 1."],
    });

    const response = await callHandler();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ cases: [] });
  });

  it("returns only needs_review cases, newest first, with the exact row shape", async () => {
    const approvedCase = createCase(db, baseCaseInput);
    insertDecision(db, approvedCase.id, {
      status: "approved",
      justification: "Zgodnie z zasadami.",
      nextSteps: ["Krok 1."],
    });

    const firstEscalated = createCase(db, {
      ...baseCaseInput,
      requestType: "reklamacja",
      category: "Laptop",
      productName: "Dell XPS 13",
      description: "Nie włącza się.",
    });
    insertDecision(db, firstEscalated.id, {
      status: "needs_human_review",
      justification: "Wymaga weryfikacji.",
      nextSteps: ["Poczekaj na kontakt pracownika."],
    });

    const secondEscalated = createCase(db, {
      ...baseCaseInput,
      productName: "JBL Flip 6",
    });
    insertDecision(db, secondEscalated.id, {
      status: "needs_human_review",
      justification: "Wymaga weryfikacji.",
      nextSteps: ["Poczekaj na kontakt pracownika."],
    });

    const response = await callHandler();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.cases).toEqual([
      {
        caseId: secondEscalated.id,
        caseNumber: secondEscalated.caseNumber,
        createdAt: secondEscalated.createdAt,
        requestType: secondEscalated.requestType,
        category: secondEscalated.category,
        productName: secondEscalated.productName,
      },
      {
        caseId: firstEscalated.id,
        caseNumber: firstEscalated.caseNumber,
        createdAt: firstEscalated.createdAt,
        requestType: firstEscalated.requestType,
        category: firstEscalated.category,
        productName: firstEscalated.productName,
      },
    ]);

    // No extra fields (e.g. description) should leak into the reviewer list.
    for (const row of body.cases) {
      expect(Object.keys(row).sort()).toEqual(
        ["caseId", "caseNumber", "category", "createdAt", "productName", "requestType"].sort(),
      );
    }
  });
});
