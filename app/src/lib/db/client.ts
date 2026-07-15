import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";

export type AppDatabase = BetterSQLite3Database<typeof schema>;

const DEFAULT_DB_PATH = path.resolve(process.cwd(), "data", "copilot.sqlite");
const DEFAULT_MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

export interface CreateDbOptions {
  /** Absolute file path, or ":memory:" for an ephemeral DB. Defaults to data/copilot.sqlite. */
  filePath?: string;
  /** Apply pending migrations right after connecting. Defaults to true. */
  runMigrations?: boolean;
  /** Absolute path to the drizzle-kit migrations folder. Defaults to <cwd>/drizzle. */
  migrationsFolder?: string;
}

export interface DbHandle {
  db: AppDatabase;
  /** Underlying better-sqlite3 connection — exposed for pragmas/close in tests. */
  sqlite: Database.Database;
  close: () => void;
}

/**
 * Creates a fresh better-sqlite3 connection + Drizzle instance with WAL mode
 * and foreign keys enabled, migrations applied (unless disabled).
 *
 * Tests should call this directly with an isolated `filePath` (a temp file or
 * ":memory:") rather than going through the app singleton below, so each test
 * gets its own schema instance — real SQLite, no mocks, per ADR-003 §8.
 */
export function createDb(options: CreateDbOptions = {}): DbHandle {
  const filePath = options.filePath ?? DEFAULT_DB_PATH;

  if (filePath !== ":memory:") {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const sqlite = new Database(filePath);
  // WAL mode per ADR-003 D3-01; foreign_keys is off by default in SQLite and
  // must be enabled per-connection for ON DELETE CASCADE to take effect.
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  if (options.runMigrations ?? true) {
    migrate(db, {
      migrationsFolder: options.migrationsFolder ?? DEFAULT_MIGRATIONS_FOLDER,
    });
  }

  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}

let singleton: DbHandle | undefined;

/**
 * Singleton DB instance for app runtime use (route handlers, `lib/ai` tool
 * executes). Applies pending migrations on first access in development —
 * ADR-003 D3-02: a fresh clone reaches a working DB with zero manual steps.
 */
export function getDb(): AppDatabase {
  if (!singleton) {
    singleton = createDb({ runMigrations: process.env.NODE_ENV !== "production" });
  }
  return singleton.db;
}

/** Test-only: drop the singleton so the next getDb() call reconnects. */
export function resetDbSingleton(): void {
  singleton?.close();
  singleton = undefined;
}
