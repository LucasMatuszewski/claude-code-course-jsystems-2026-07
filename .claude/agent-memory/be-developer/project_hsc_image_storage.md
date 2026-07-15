---
name: project-hsc-image-storage
description: Hardware Service Decision Copilot PoC — image compression + storage module design (P1.3), for later tasks (P2.2 image route handler) that consume lib/images/**
metadata:
  type: project
---

`app/src/lib/images/compress.ts` and `app/src/lib/images/storage.ts` implement ADR-002 §6 / ADR-003 §3,§6. Committed as `babd475` on branch `moja-praca`. See [[project_hsc_persistence_layer]] for the related DB-layer conventions.

Key design points later tasks (P2.2 `GET` image route handler) must know:
- `compressImage(input: Buffer): Promise<Buffer>` — sharp `.resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 })`. Exports `MAX_DIMENSION=1600`, `JPEG_QUALITY=80` as named constants.
- `writeCaseImage(caseId, buffer, baseDir?)` / `readCaseImage(relativePath, baseDir?)` — both take an injectable `baseDir` (default `path.join(process.cwd(), "uploads")`) so tests use a temp dir; production code should call with no `baseDir` arg (or `DEFAULT_UPLOADS_DIR` explicitly).
- **Important quirk:** the `relativePath` returned by `writeCaseImage` is a *logical* path always shaped `uploads/<caseId>/<seq>.jpg` (POSIX separators) — it is NOT computed as `path.relative(baseDir, absolutePath)`. This is deliberate: ADR-003 says `case_images.file_path` is "relative path under app/uploads/", and the task spec required the literal `uploads/...` shape even when tests inject a temp `baseDir` standing in for the real uploads root. `readCaseImage` strips a leading `uploads` segment (if present) before resolving against `baseDir`, so both `"uploads/x/1.jpg"` and `"x/1.jpg"` work as input.
- Sequence numbers are derived by scanning the case directory for existing `<n>.jpg` files (`Math.max(existing) + 1`), NOT from a DB counter or in-memory state — storage.ts has no DB dependency by design (keeps P1.3 fully independent of the `lib/db` work happening in parallel).
- Path-traversal defense (TAC-003-05 groundwork) has two layers: (1) reject any `..` path segment outright, (2) after resolving, verify the resolved absolute path is still inside `resolvedBase` via string-prefix check — the second check is the real safety net since Windows `path.resolve` does *not* treat a lone drive-letter segment (e.g. `"C:"`) as absolute the way you'd expect (it silently falls back toward `process.cwd()` on that drive instead of throwing), so an attacker-supplied absolute path with a drive letter can produce a surprising resolved path — always keep the prefix-containment check as the authoritative guard, don't rely on segment-level heuristics alone.
