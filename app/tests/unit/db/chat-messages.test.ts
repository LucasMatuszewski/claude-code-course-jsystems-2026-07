import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "@/lib/db/client";
import { createCase, getCaseWithHistory } from "@/lib/db/cases";
import { appendChatMessage, listChatMessagesByCaseId } from "@/lib/db/chat-messages";

function tempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hsc-db-chat-messages-"));
  return path.join(dir, "copilot.db");
}

describe("chat-messages repository", () => {
  let dbPath: string;
  let db: Database.Database;
  let caseId: string;

  beforeEach(() => {
    dbPath = tempDbPath();
    db = createDb(dbPath);
    caseId = createCase(db, {
      requestType: "zwrot",
      category: "elektronika",
      productName: "Klawiatura",
      purchaseDate: "2026-06-15",
      description: null,
    }).id;
  });

  afterEach(() => {
    db.close();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it("appends a message and round-trips arbitrary parts", () => {
    const parts = [
      { type: "text", text: "Cześć, mam pytanie" },
      { type: "file", url: "https://example.com/a.jpg", mediaType: "image/jpeg" },
    ];

    const message = appendChatMessage(db, caseId, "user", parts);

    expect(message.role).toBe("user");
    expect(message.parts).toEqual(parts);
  });

  it("bumps cases.updated_at when a message is appended", () => {
    const before = getCaseWithHistory(db, caseId)!.updatedAt;

    appendChatMessage(db, caseId, "assistant", [{ type: "text", text: "Odpowiedź" }]);

    const after = getCaseWithHistory(db, caseId)!.updatedAt;
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
  });

  it("lists messages for a case ordered by created_at ascending", () => {
    const first = appendChatMessage(db, caseId, "user", [{ type: "text", text: "1" }]);
    const second = appendChatMessage(db, caseId, "assistant", [
      { type: "text", text: "2" },
    ]);

    const messages = listChatMessagesByCaseId(db, caseId);
    expect(messages.map((m) => m.id)).toEqual([first.id, second.id]);
  });

  it("throws (FK violation) when the case does not exist", () => {
    expect(() =>
      appendChatMessage(db, "missing-case", "user", [{ type: "text", text: "x" }]),
    ).toThrow();
  });
});
