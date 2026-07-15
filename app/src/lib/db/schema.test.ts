import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDb, type DbHandle } from "./client";

// ADR-003 §8: "Fresh-clone bootstrap" — migrations create all tables from an
// empty data directory; re-running startup against an already-migrated DB
// is a no-op. Real SQLite (temp files), no mocks.
describe("db bootstrap (ADR-003 §8 fresh-clone bootstrap, TAC-003-01)", () => {
  let tempDir: string;
  let handle: DbHandle | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "copilot-db-test-"));
  });

  afterEach(() => {
    handle?.close();
    handle = undefined;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates all tables from an empty data directory", () => {
    const dbFile = path.join(tempDir, "copilot.sqlite");
    handle = createDb({ filePath: dbFile });

    const tableNames = handle.sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
      )
      .all()
      .map((row) => (row as { name: string }).name)
      .sort();

    expect(tableNames).toEqual(["decisions", "messages", "sessions"]);
  });

  it("re-running startup migrations against an already-migrated DB is a no-op", () => {
    const dbFile = path.join(tempDir, "copilot.sqlite");
    handle = createDb({ filePath: dbFile });
    handle.close();

    expect(() => {
      handle = createDb({ filePath: dbFile });
    }).not.toThrow();

    const tableNames = handle!.sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
      )
      .all()
      .map((row) => (row as { name: string }).name)
      .sort();
    expect(tableNames).toEqual(["decisions", "messages", "sessions"]);
  });
});

// ADR-003 §8: "Enum CHECK constraints" — invalid categories are
// unrepresentable at the DB layer (TAC-04), independent of any application
// validation. Exercised with raw SQL so the DB constraint itself is under
// test, not the repository layer.
describe("enum CHECK constraints (TAC-04)", () => {
  let handle: DbHandle;

  beforeEach(() => {
    handle = createDb({ filePath: ":memory:" });
  });

  afterEach(() => {
    handle.close();
  });

  function insertSession(overrides: Partial<Record<string, string>> = {}) {
    const values = {
      id: "s1",
      request_type: "complaint",
      category: "smartphone",
      product_name: "Phone",
      purchase_date: "2026-01-01",
      image_path: "p.jpg",
      image_original_name: "p.jpg",
      image_media_type: "image/jpeg",
      status: "created",
      created_at: "1",
      ...overrides,
    };
    const columns = Object.keys(values).join(", ");
    const placeholders = Object.keys(values)
      .map(() => "?")
      .join(", ");
    return handle.sqlite
      .prepare(`INSERT INTO sessions (${columns}) VALUES (${placeholders})`)
      .run(...Object.values(values));
  }

  it("rejects an invalid request_type", () => {
    expect(() => insertSession({ request_type: "bogus" })).toThrow(/CHECK constraint failed/);
  });

  it("rejects an invalid category", () => {
    expect(() => insertSession({ category: "bogus" })).toThrow(/CHECK constraint failed/);
  });

  it("rejects an invalid status", () => {
    expect(() => insertSession({ status: "bogus" })).toThrow(/CHECK constraint failed/);
  });

  it("accepts every valid status/category/request_type combination", () => {
    expect(() => insertSession()).not.toThrow();
  });

  it("rejects an invalid decision category", () => {
    insertSession();
    expect(() =>
      handle.sqlite
        .prepare(
          "INSERT INTO decisions (session_id, decision, justification, cited_rule_ids, source, guard_override, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run("s1", "BOGUS", "x", "[]", "initial", 0, 1),
    ).toThrow(/CHECK constraint failed/);
  });

  it("rejects an invalid decision source", () => {
    insertSession();
    expect(() =>
      handle.sqlite
        .prepare(
          "INSERT INTO decisions (session_id, decision, justification, cited_rule_ids, source, guard_override, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run("s1", "APPROVE", "x", "[]", "bogus_source", 0, 1),
    ).toThrow(/CHECK constraint failed/);
  });

  it("rejects an invalid previous_decision", () => {
    insertSession();
    expect(() =>
      handle.sqlite
        .prepare(
          "INSERT INTO decisions (session_id, decision, previous_decision, justification, cited_rule_ids, source, guard_override, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run("s1", "APPROVE", "BOGUS", "x", "[]", "initial", 0, 1),
    ).toThrow(/CHECK constraint failed/);
  });

  it("rejects an invalid message role", () => {
    insertSession();
    expect(() =>
      handle.sqlite
        .prepare("INSERT INTO messages (id, session_id, role, parts, created_at) VALUES (?, ?, ?, ?, ?)")
        .run("m1", "s1", "bogus_role", "[]", 1),
    ).toThrow(/CHECK constraint failed/);
  });
});
