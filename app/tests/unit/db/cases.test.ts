import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "@/lib/db/client";
import { createCase, getCaseWithHistory, listEscalatedCases } from "@/lib/db/cases";
import { insertDecision } from "@/lib/db/decisions";
import { insertCaseImage } from "@/lib/db/case-images";
import { insertImageAnalysis } from "@/lib/db/image-analyses";
import { appendChatMessage } from "@/lib/db/chat-messages";

function tempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hsc-db-cases-"));
  return path.join(dir, "copilot.db");
}

const validInput = {
  requestType: "zwrot" as const,
  category: "elektronika",
  productName: "Ekspres do kawy",
  purchaseDate: "2026-06-01",
  description: null,
};

describe("cases repository", () => {
  let dbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    dbPath = tempDbPath();
    db = createDb(dbPath);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  describe("createCase", () => {
    it("inserts a case and returns it with a formatted, unique case_number", () => {
      const created = createCase(db, validInput);

      expect(created.id).toBeTruthy();
      expect(created.caseNumber).toMatch(/^HSC-\d{8}-\d{4}$/);
      expect(created.needsReview).toBe(false);
      expect(created.requestType).toBe("zwrot");
      expect(created.category).toBe("elektronika");
    });

    it("generates collision-safe case numbers for many cases created the same day", () => {
      const cases = Array.from({ length: 25 }, () => createCase(db, validInput));
      const caseNumbers = cases.map((c) => c.caseNumber);

      expect(new Set(caseNumbers).size).toBe(caseNumbers.length);
      // sequence should be strictly increasing 0001..0025
      const sequences = caseNumbers
        .map((n) => Number(n.split("-")[2]))
        .sort((a, b) => a - b);
      expect(sequences).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    });
  });

  describe("getCaseWithHistory", () => {
    it("returns null for a nonexistent case", () => {
      expect(getCaseWithHistory(db, "does-not-exist")).toBeNull();
    });

    it("returns the case with images, analyses, decisions, and messages ordered by created_at", () => {
      const created = createCase(db, validInput);

      const image1 = insertCaseImage(db, created.id, {
        filePath: "uploads/case/1.jpg",
        source: "form",
        originalFilename: "photo1.jpg",
        mimeType: "image/jpeg",
      });
      const image2 = insertCaseImage(db, created.id, {
        filePath: "uploads/case/2.jpg",
        source: "chat_reupload",
        originalFilename: "photo2.jpg",
        mimeType: "image/jpeg",
      });

      insertImageAnalysis(db, created.id, image1.id, {
        conclusive: true,
        analysis: { verdict: "matches description", confidence: 0.9 },
      });
      insertImageAnalysis(db, created.id, image2.id, {
        conclusive: false,
        analysis: { verdict: "unclear", confidence: 0.3 },
      });

      insertDecision(db, created.id, {
        status: "needs_human_review",
        justification: "Zdjęcie niejednoznaczne",
        nextSteps: ["Skontaktuj się z klientem"],
      });
      insertDecision(db, created.id, {
        status: "approved",
        justification: "Rozstrzygnięto po rozmowie",
        nextSteps: ["Wyślij etykietę zwrotną"],
      });

      appendChatMessage(db, created.id, "user", [{ type: "text", text: "Cześć" }]);
      appendChatMessage(db, created.id, "assistant", [
        { type: "text", text: "W czym mogę pomóc?" },
      ]);

      const detail = getCaseWithHistory(db, created.id);

      expect(detail).not.toBeNull();
      expect(detail!.images.map((i) => i.id)).toEqual([image1.id, image2.id]);
      expect(detail!.analyses).toHaveLength(2);
      expect(detail!.analyses[0].conclusive).toBe(true);
      expect(detail!.analyses[1].conclusive).toBe(false);
      expect(detail!.decisions.map((d) => d.status)).toEqual([
        "needs_human_review",
        "approved",
      ]);
      expect(detail!.decisions[0].isRevision).toBe(false);
      expect(detail!.decisions[1].isRevision).toBe(true);
      expect(detail!.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
      // needs_review stays 1 even though the latest decision is "approved" (one-way flag)
      expect(detail!.needsReview).toBe(true);
    });

    it("round-trips a large parts_json chat payload intact", () => {
      const created = createCase(db, validInput);
      const largeParts = Array.from({ length: 500 }, (_, i) => ({
        type: "text",
        text: `Wiadomość numer ${i} `.repeat(50),
      }));

      appendChatMessage(db, created.id, "user", largeParts);

      const detail = getCaseWithHistory(db, created.id);
      expect(detail!.messages[0].parts).toEqual(largeParts);
    });
  });

  describe("listEscalatedCases", () => {
    it("returns an empty array when there are no escalated cases", () => {
      createCase(db, validInput);
      expect(listEscalatedCases(db)).toEqual([]);
    });

    it("only returns cases with needs_review = 1, ordered created_at DESC (TAC-003-03)", () => {
      const caseA = createCase(db, validInput);
      const caseB = createCase(db, validInput);
      const caseC = createCase(db, validInput);

      insertDecision(db, caseB.id, {
        status: "needs_human_review",
        justification: "j",
        nextSteps: [],
      });
      insertDecision(db, caseC.id, {
        status: "needs_human_review",
        justification: "j",
        nextSteps: [],
      });
      // caseA never escalated

      const escalated = listEscalatedCases(db);

      expect(escalated.map((c) => c.id)).toEqual([caseC.id, caseB.id]);
      expect(escalated.every((c) => c.needsReview)).toBe(true);
      expect(escalated.some((c) => c.id === caseA.id)).toBe(false);
    });

    it("keeps a case in the escalated list even after a later approved/rejected revision (one-way flag, TAC-003-02)", () => {
      const created = createCase(db, validInput);
      insertDecision(db, created.id, {
        status: "needs_human_review",
        justification: "j",
        nextSteps: [],
      });
      insertDecision(db, created.id, {
        status: "rejected",
        justification: "resolved",
        nextSteps: [],
      });

      const escalated = listEscalatedCases(db);
      expect(escalated.map((c) => c.id)).toContain(created.id);
    });
  });

  describe("foreign key enforcement", () => {
    it("throws when inserting a case image for a nonexistent case", () => {
      expect(() =>
        insertCaseImage(db, "nonexistent-case-id", {
          filePath: "uploads/x.jpg",
          source: "form",
          originalFilename: "x.jpg",
          mimeType: "image/jpeg",
        }),
      ).toThrow();
    });

    it("throws when inserting a decision for a nonexistent case", () => {
      expect(() =>
        insertDecision(db, "nonexistent-case-id", {
          status: "approved",
          justification: "j",
          nextSteps: [],
        }),
      ).toThrow();
    });

    it("throws when appending a chat message for a nonexistent case", () => {
      expect(() =>
        appendChatMessage(db, "nonexistent-case-id", "user", [{ type: "text", text: "x" }]),
      ).toThrow();
    });
  });

  describe("restart durability (TAC-003-04)", () => {
    it("keeps all rows readable after closing and reopening the connection", () => {
      const created = createCase(db, validInput);
      const image = insertCaseImage(db, created.id, {
        filePath: "uploads/x.jpg",
        source: "form",
        originalFilename: "x.jpg",
        mimeType: "image/jpeg",
      });
      insertImageAnalysis(db, created.id, image.id, {
        conclusive: true,
        analysis: { verdict: "ok" },
      });
      insertDecision(db, created.id, {
        status: "approved",
        justification: "j",
        nextSteps: ["a", "b"],
      });
      appendChatMessage(db, created.id, "user", [{ type: "text", text: "hej" }]);

      db.close();
      db = createDb(dbPath);

      const detail = getCaseWithHistory(db, created.id);
      expect(detail).not.toBeNull();
      expect(detail!.images).toHaveLength(1);
      expect(detail!.analyses).toHaveLength(1);
      expect(detail!.decisions).toHaveLength(1);
      expect(detail!.messages).toHaveLength(1);
    });
  });
});
