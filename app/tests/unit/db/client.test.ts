import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { createDb } from "@/lib/db/client";

function tempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hsc-db-client-"));
  return path.join(dir, "copilot.db");
}

describe("createDb", () => {
  let db: Database.Database | undefined;
  let dbPath: string | undefined;

  afterEach(() => {
    db?.close();
    if (dbPath) {
      fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
    }
    db = undefined;
    dbPath = undefined;
  });

  it("enables foreign key enforcement on every connection (TAC-003-01)", () => {
    dbPath = tempDbPath();
    db = createDb(dbPath);

    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  it("bootstraps the schema so all tables exist on first connection", () => {
    dbPath = tempDbPath();
    db = createDb(dbPath);

    const tableNames = (
      db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
        .all() as Array<{ name: string }>
    ).map((row) => row.name);

    expect(tableNames).toEqual(
      expect.arrayContaining([
        "cases",
        "case_images",
        "image_analyses",
        "decisions",
        "chat_messages",
      ]),
    );
  });

  it("is idempotent: reopening the same file does not error and preserves data", () => {
    dbPath = tempDbPath();
    db = createDb(dbPath);
    db.prepare(
      `INSERT INTO cases (id, case_number, request_type, category, product_name, purchase_date, needs_review, created_at, updated_at)
       VALUES ('c1', 'HSC-20260714-0001', 'zwrot', 'other', 'Widget', '2026-07-01', 0, '2026-07-14T10:00:00.000Z', '2026-07-14T10:00:00.000Z')`,
    ).run();
    db.close();

    db = createDb(dbPath);
    const row = db.prepare(`SELECT * FROM cases WHERE id = 'c1'`).get();
    expect(row).toBeDefined();
  });
});
