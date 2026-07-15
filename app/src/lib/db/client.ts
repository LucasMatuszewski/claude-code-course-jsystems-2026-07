/**
 * SQLite connection factory (ADR-003 §3).
 *
 * `createDb` is the injectable entry point: tests pass a temp-file path so
 * every test gets an isolated database, while `getDb()` lazily opens (and
 * memoizes) the shared connection at `DEFAULT_DB_PATH` for application code.
 *
 * Every connection gets `PRAGMA foreign_keys = ON` (TAC-003-01) and the
 * idempotent schema bootstrap from `schema.sql` (`CREATE TABLE IF NOT
 * EXISTS ...` — no migration framework at this scale, per ADR-003 §3).
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(currentDir, "schema.sql");

/** Default on-disk location, relative to the `app/` working directory. */
export const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "copilot.db");

/**
 * Opens (creating if necessary) a SQLite database at `dbPath`, enables
 * foreign key enforcement, and applies the schema. Callers own the
 * returned connection and must `close()` it when done (tests always do;
 * the shared `getDb()` connection lives for the process lifetime).
 */
export function createDb(dbPath: string = DEFAULT_DB_PATH): Database.Database {
  const dir = path.dirname(dbPath);
  if (dir && dir !== ".") {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");

  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);

  return db;
}

let sharedDb: Database.Database | undefined;

/**
 * Returns the process-wide shared connection at `DEFAULT_DB_PATH`, opening
 * it on first use. Application code (API routes) should use this; tests
 * should use `createDb(tempPath)` instead to stay isolated.
 */
export function getDb(): Database.Database {
  if (!sharedDb) {
    sharedDb = createDb();
  }
  return sharedDb;
}

/** Closes and clears the shared connection, if one was opened. */
export function closeSharedDb(): void {
  if (sharedDb) {
    sharedDb.close();
    sharedDb = undefined;
  }
}
