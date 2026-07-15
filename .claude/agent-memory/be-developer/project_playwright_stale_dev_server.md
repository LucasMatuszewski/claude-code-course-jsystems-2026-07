---
name: project-playwright-stale-dev-server
description: Playwright's webServer reuseExistingServer:true does not detect a broken/hung leftover `next dev` process on port 3000 — it still tries to spawn a new one and Next.js refuses, crashing the webServer boot.
metadata:
  type: project
---

On this VM, a previous session's `npm run dev` (e.g. left running from manual verification or a prior agent task) can still hold port 3000 while actually returning HTTP 500 (broken/stale). When `playwright.config.ts` has `webServer.reuseExistingServer: true` and you run `npx playwright test`, Playwright's readiness probe did not treat that broken server as "already up" — it still tried to spawn `npm run dev` via the webServer command, and Next.js itself then refused with `Another next dev server is already running` (port-lock mechanism), crashing the whole webServer bootstrap with a non-obvious error.

**Why:** Confirmed while implementing P0.2 (Vitest + Playwright scaffolding, `app/playwright.config.ts`) — `curl`/`fetch` to `http://localhost:3000/` showed the stale process (leftover node.exe PID) answering with a 500, not a clean 200, which is likely why Playwright didn't short-circuit as "reuse this".

**How to apply:** Before running `npx playwright test` (or `npm run test:e2e`) locally on this VM, check for and kill any stray `node.exe` holding port 3000 from an earlier session (`tasklist //FI "IMAGENAME eq node.exe"`, then `taskkill //PID <pid> //F`) if the run fails with a webServer boot error mentioning "Another next dev server is already running". This is a leftover-process hygiene issue, not a config bug — do not "fix" it by changing `reuseExistingServer` or the webServer command. Related: [[project-dev-dir-casing]] — the webServer's `cwd` must still be the canonical uppercase `DEV` path.
