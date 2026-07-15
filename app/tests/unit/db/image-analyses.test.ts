import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "@/lib/db/client";
import { createCase } from "@/lib/db/cases";
import { insertCaseImage } from "@/lib/db/case-images";
import { insertImageAnalysis, listImageAnalysesByCaseId } from "@/lib/db/image-analyses";

function tempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hsc-db-image-analyses-"));
  return path.join(dir, "copilot.db");
}

describe("image-analyses repository", () => {
  let dbPath: string;
  let db: Database.Database;
  let caseId: string;
  let caseImageId: string;

  beforeEach(() => {
    dbPath = tempDbPath();
    db = createDb(dbPath);
    caseId = createCase(db, {
      requestType: "reklamacja",
      category: "agd",
      productName: "Odkurzacz",
      purchaseDate: "2026-05-01",
      description: "Nie włącza się",
    }).id;
    caseImageId = insertCaseImage(db, caseId, {
      filePath: "uploads/case-1/1.jpg",
      source: "form",
      originalFilename: "front.jpg",
      mimeType: "image/jpeg",
    }).id;
  });

  afterEach(() => {
    db.close();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it("inserts an analysis and round-trips the analysis JSON object", () => {
    const analysis = {
      verdict: "damage visible",
      confidence: 0.87,
      internalNotes: "reviewer-only note",
      tags: ["scratch", "dent"],
    };

    const inserted = insertImageAnalysis(db, caseId, caseImageId, {
      conclusive: true,
      analysis,
    });

    expect(inserted.conclusive).toBe(true);
    expect(inserted.analysis).toEqual(analysis);
  });

  it("lists analyses for a case ordered by created_at ascending", () => {
    const first = insertImageAnalysis(db, caseId, caseImageId, {
      conclusive: true,
      analysis: { verdict: "a" },
    });
    const second = insertImageAnalysis(db, caseId, caseImageId, {
      conclusive: false,
      analysis: { verdict: "b" },
    });

    const analyses = listImageAnalysesByCaseId(db, caseId);
    expect(analyses.map((a) => a.id)).toEqual([first.id, second.id]);
  });

  it("throws (FK violation) when the case does not exist", () => {
    expect(() =>
      insertImageAnalysis(db, "missing-case", caseImageId, {
        conclusive: true,
        analysis: { verdict: "x" },
      }),
    ).toThrow();
  });

  it("throws (FK violation) when the case image does not exist", () => {
    expect(() =>
      insertImageAnalysis(db, caseId, "missing-image", {
        conclusive: true,
        analysis: { verdict: "x" },
      }),
    ).toThrow();
  });
});
