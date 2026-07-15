---
name: project-dev-dir-casing
description: Repo directory is physically named DEV (uppercase) on disk; running Node/npm builds from a lowercase-cased path (dev) causes a Next.js/webpack InvariantError.
metadata:
  type: project
---

The repository's on-disk directory is actually `C:\Users\labuser\DEV\claude-code-course-jsystems-2026-07` (uppercase `DEV`), even though it is commonly referred to/typed as `...\dev\...` (lowercase) everywhere — including the Bash tool's default `$PWD`.

Windows' filesystem is case-insensitive, so both paths open the same folder — but webpack/Turbopack's module resolution is not. Running `npm run build` (Next.js 16.2.10, App Router) from a lowercase-cased `dev` path causes internal Next.js modules to be loaded twice under two differently-cased absolute paths, splitting a singleton (the request-scoped `workStore`), which throws `Error [InvariantError]: Invariant: Expected workStore to be initialized. This is a bug in Next.js.` while prerendering auto-generated pages (`/_not-found`, `/_global-error`). `npm run lint` and `npm run dev` are unaffected (no prerendering) — only `next build` fails.

**Why:** Confirmed root cause via `ls -la C:/Users/labuser | grep -i dev` (shows `DEV`) and reproducing the failure with both Turbopack and webpack on a vanilla, unmodified `create-next-app` scaffold. Orchestrator independently confirmed: build exits 0 when run from the canonical uppercase path, and fails when cwd casing differs.

**How to apply:** Renaming the on-disk directory to fix this permanently is currently blocked (Access denied — open handles from the running Claude Code session/MCP servers) and is NOT to be attempted casually. Do NOT patch around this in `package.json` scripts or add wrapper scripts — keep the scaffold vanilla. Instead, always `cd` to the canonical uppercase path before running `npm run build` (or any Node/webpack build) in `app/`:
- Git Bash: `cd /c/Users/labuser/DEV/claude-code-course-jsystems-2026-07/app`
- PowerShell/cmd: `cd C:\Users\labuser\DEV\claude-code-course-jsystems-2026-07\app`

This applies to any future build/verification command in this repo, not just the initial P0.1 scaffold task.
