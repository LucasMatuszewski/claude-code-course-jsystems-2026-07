import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "@/lib/db/client";
import { createCase } from "@/lib/db/cases";
import { insertCaseImage, listCaseImagesByCaseId } from "@/lib/db/case-images";

function tempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hsc-db-case-images-"));
  return path.join(dir, "copilot.db");
}

describe("case-images repository", () => {
  let dbPath: string;
  let db: Database.Database;
  let caseId: string;

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
  });

  afterEach(() => {
    db.close();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it("inserts a case image and returns the stored row", () => {
    const image = insertCaseImage(db, caseId, {
      filePath: "uploads/case-1/1.jpg",
      source: "form",
      originalFilename: "front.jpg",
      mimeType: "image/jpeg",
    });

    expect(image.id).toBeTruthy();
    expect(image.caseId).toBe(caseId);
    expect(image.source).toBe("form");
    expect(image.originalFilename).toBe("front.jpg");
  });

  it("lists images for a case ordered by created_at ascending", () => {
    const first = insertCaseImage(db, caseId, {
      filePath: "uploads/case-1/1.jpg",
      source: "form",
      originalFilename: "a.jpg",
      mimeType: "image/jpeg",
    });
    const second = insertCaseImage(db, caseId, {
      filePath: "uploads/case-1/2.jpg",
      source: "chat_reupload",
      originalFilename: "b.jpg",
      mimeType: "image/jpeg",
    });

    const images = listCaseImagesByCaseId(db, caseId);
    expect(images.map((i) => i.id)).toEqual([first.id, second.id]);
  });

  it("throws (FK violation) when the case does not exist", () => {
    expect(() =>
      insertCaseImage(db, "missing-case", {
        filePath: "uploads/x.jpg",
        source: "form",
        originalFilename: "x.jpg",
        mimeType: "image/jpeg",
      }),
    ).toThrow();
  });
});
