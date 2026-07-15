---
name: project-hsc-persistence-layer
description: Hardware Service Decision Copilot PoC — SQLite persistence layer conventions (P1.2), for later tasks (P1.3, P2.x) that consume lib/db/**
metadata:
  type: project
---

`app/src/lib/db/**` (client.ts, cases.ts, case-images.ts, image-analyses.ts, decisions.ts, chat-messages.ts + schema.sql) implements ADR-003 for the Hardware Service Decision Copilot PoC. Committed as `b90aacd` on branch `moja-praca`.

Key conventions later tasks (P1.3 image storage, P2.x API routes) must follow:
- All repo functions take an explicit `db: Database.Database` first parameter (dependency injection for testability) — NOT a module-level singleton call inside each function. Route handlers should call `getDb()` from `client.ts` once and pass it in.
- `getDb()` (shared, memoized) vs `createDb(path)` (factory, used by tests with a per-test temp file) — both exported from `client.ts`. Default path: `path.join(process.cwd(), "data", "copilot.db")` (`app/data/` already gitignored). Assumes cwd is `app/` (matches how this project's npm scripts and Next dev/build/start are always run per project convention).
- `client.ts` resolves `schema.sql`'s path via `path.dirname(fileURLToPath(import.meta.url))`, not `__dirname` (tsconfig targets `esnext`/bundler resolution) — this worked cleanly through both Vitest and `next build` (Turbopack) in this Next.js 16 project, so it's a safe pattern to reuse for other lib files here that need to read a sibling non-TS asset at runtime.
- `needs_review` is one-way (set on `needs_human_review`, never reset) — see [[feedback_adr_first_dev_docs]] if it exists, otherwise: always read the relevant ADR §6 "Technical Decisions" section before changing DB write logic, since business rules like this live there, not in the schema.
- JSON columns (`analysis_json`, `next_steps_json`, `parts_json`) are opaque `unknown`/`unknown[]` at the repo-module boundary — repo modules do NOT import types from the AI layer or copy/validation modules (owned by other agents/tasks) to avoid cross-task coupling before those modules exist.
- Ordering queries use `ORDER BY created_at ASC/DESC, rowid ASC/DESC` (rowid as a tie-breaker for same-millisecond inserts) even though ADR-003 only mentions `created_at` — a deliberate, non-breaking robustness addition, not a deviation from the spec's intent.
