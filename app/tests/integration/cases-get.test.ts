// @vitest-environment node

/**
 * Integration tests for `GET /api/cases/[caseId]` (ADR-000 §6; ADR-003 §5).
 *
 * Real temp SQLite file, real `lib/db/**` repository functions — no AI, no
 * filesystem uploads involved. Exercised through the dependency-injected
 * factory `createCaseGetHandler`, matching the P2.1 DI seam pattern.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createCaseGetHandler } from "@/app/api/cases/[caseId]/route";
import { createDb } from "@/lib/db/client";
import { createCase } from "@/lib/db/cases";
import { insertCaseImage } from "@/lib/db/case-images";
import { insertImageAnalysis } from "@/lib/db/image-analyses";
import { insertDecision } from "@/lib/db/decisions";
import { appendChatMessage } from "@/lib/db/chat-messages";
import { pl } from "@/lib/copy/pl";

let db: Database.Database;

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hsc-cases-get-"));
  db = createDb(path.join(dir, "copilot.db"));
});

afterEach(() => {
  db.close();
});

function makeContext(caseId: string): { params: Promise<{ caseId: string }> } {
  return { params: Promise.resolve({ caseId }) };
}

describe("GET /api/cases/[caseId]", () => {
  it("returns the full case state (form data, images, analyses, decisions, messages) in order", async () => {
    const created = createCase(db, {
      requestType: "zwrot",
      category: "Słuchawki",
      productName: "Sony WH-1000XM5",
      purchaseDate: "2025-06-01",
    });

    const image1 = insertCaseImage(db, created.id, {
      filePath: "uploads/x/1.jpg",
      source: "form",
      originalFilename: "a.jpg",
      mimeType: "image/jpeg",
    });
    const image2 = insertCaseImage(db, created.id, {
      filePath: "uploads/x/2.jpg",
      source: "chat_reupload",
      originalFilename: "b.jpg",
      mimeType: "image/jpeg",
    });

    insertImageAnalysis(db, created.id, image1.id, {
      conclusive: false,
      analysis: { note: "blurry" },
    });
    insertImageAnalysis(db, created.id, image2.id, {
      conclusive: true,
      analysis: { note: "clear" },
    });

    insertDecision(db, created.id, {
      status: "needs_human_review",
      justification: "j1",
      nextSteps: ["s1"],
    });
    insertDecision(db, created.id, {
      status: "approved",
      justification: "j2",
      nextSteps: ["s2"],
    });

    appendChatMessage(db, created.id, "assistant", [{ type: "text", text: "hello" }]);
    appendChatMessage(db, created.id, "user", [{ type: "text", text: "thanks" }]);

    const handler = createCaseGetHandler({ db });
    const res = await handler(
      new Request(`http://localhost/api/cases/${created.id}`),
      makeContext(created.id),
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.id).toBe(created.id);
    expect(body.caseNumber).toBe(created.caseNumber);
    expect(body.requestType).toBe("zwrot");
    expect(body.productName).toBe("Sony WH-1000XM5");
    expect(body.needsReview).toBe(true);

    expect(body.images).toHaveLength(2);
    expect(body.images[0].filePath).toBe("uploads/x/1.jpg");
    expect(body.images[1].filePath).toBe("uploads/x/2.jpg");

    expect(body.analyses).toHaveLength(2);
    expect(body.analyses[0].conclusive).toBe(false);
    expect(body.analyses[1].conclusive).toBe(true);

    expect(body.decisions).toHaveLength(2);
    expect(body.decisions[0].status).toBe("needs_human_review");
    expect(body.decisions[0].isRevision).toBe(false);
    expect(body.decisions[1].status).toBe("approved");
    expect(body.decisions[1].isRevision).toBe(true);

    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("assistant");
    expect(body.messages[1].role).toBe("user");
  });

  it("returns 404 with the Polish caseNotFound message for an unknown caseId", async () => {
    const handler = createCaseGetHandler({ db });
    const res = await handler(
      new Request("http://localhost/api/cases/does-not-exist"),
      makeContext("does-not-exist"),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe(pl.errors.caseNotFound);
  });
});
