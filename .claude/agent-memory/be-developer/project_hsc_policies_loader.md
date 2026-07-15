---
name: project-hsc-policies-loader
description: Hardware Service Decision Copilot PoC — policy document loader (P1.4) signature/conventions, for P1.5 (AI layer) and later tasks that consume lib/policies/loader.ts
metadata:
  type: project
---

`app/src/lib/policies/loader.ts` implements ADR-000 §8 for the Hardware Service Decision Copilot PoC. Committed as `db587f3` on branch `moja-praca`, alongside [[project_hsc_persistence_layer]].

- Exported signature: `loadPolicy(type: "zwrot" | "reklamacja", policiesDir?: string): string`. Second param is optional, DI-style like `lib/db/client.ts`'s `createDb(path)` — tests inject a temp dir; production code omits it and gets the default.
- Default `policiesDir` = `path.join(process.cwd(), "..", "docs", "policies")` — one level *above* the app root, since `docs/` is a sibling of `app/` at the repo root (not inside `app/`, unlike `lib/db`'s `data/` dir which is under `app/`). Same "assumes cwd is `app/`" convention as the db layer.
- No caching: `fs.readFileSync` fresh on every call, deliberate per ADR (policy docs are small/rare-changing; simplicity + no-stale-content wins over caching).
- Missing file throws `Error("Policy document not found: <resolved path>")` — always names the full resolved path, not just the type, so callers/tests get an actionable error.
