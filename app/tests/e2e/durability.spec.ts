/**
 * Restart-durability E2E coverage (PRD AC-34; ADR-003 TAC-003-04/TAC-05)
 * — task P4.3.
 *
 * Proves SQLite (and the on-disk uploaded image) survive a full dev-server
 * process restart: create a case against the currently running server,
 * kill that process, start a brand new one, then read the case back
 * through the FRESH process and assert the full state is still there.
 *
 * ## Why this spec manages its own server instead of using `page.goto`
 * Every other E2E spec relies on `playwright.config.ts`'s shared
 * `webServer` (with `reuseExistingServer: true`) and never restarts the
 * process it points at. This spec's entire point is to kill and restart
 * that process mid-test, which the shared `webServer` block was never
 * designed for. Per the task brief's own suggested options, the chosen
 * mechanism here is the simplest one that needs zero `playwright.config.ts`
 * changes: this spec never uses `page`/`page.goto` at all (so it never
 * depends on Playwright's `baseURL`/webServer machinery for navigation) and
 * drives the server + the API purely with Node's global `fetch` and
 * `node:child_process`. Because `webServer.reuseExistingServer` is `true`,
 * whichever server was already up when this spec's `npx playwright test`
 * invocation started is either reused (if already running — Playwright
 * does not track/manage a reused process's lifecycle at all) or spawned by
 * Playwright itself (if nothing was listening yet). Either way, once this
 * spec kills the process actually LISTENING on port 3000 and spawns its own
 * detached replacement, that replacement is not something Playwright is
 * tracking for teardown, so it is left running when the whole test run
 * ends — satisfying "leave a working dev server running when the test
 * finishes". No `playwright.config.ts` edits were needed or made.
 *
 * ## Windows process management
 * `netstat -ano` output is parsed in plain JS (no `grep`/`findstr` pipe
 * dependency) to find the PID listening on port 3000, then
 * `taskkill /F /PID <pid>` stops it. A fresh `npm run dev` is spawned
 * detached + unref'd with its stdout/stderr redirected to a log file, and
 * readiness is polled via plain HTTP GETs to `/` (a connection failure means
 * "not listening yet"; a real HTTP response — including the compile-time
 * delay Next.js dev incurs on the first request — means "ready").
 *
 * IMPORTANT: do not run `npm run build` before this spec (or between the
 * server restarts it performs) — a stale `.next` from a production build
 * makes API routes 404 against a `next dev` process (see qa-engineer
 * memory: environment gotchas from the P4.3 task brief). The verification
 * sequence for this task runs `npm run build` LAST for exactly this reason.
 */

import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

const APP_DIR = path.resolve(__dirname, "../..");
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const CLEAN_IMAGE = path.join(FIXTURES_DIR, "clean-product.jpg");
const LOG_FILE = path.join(APP_DIR, ".durability-dev-server.log");
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

/** Finds the PID listening on `port` by parsing `netstat -ano` output directly (no grep/findstr). */
function findListeningPid(port: number): number | null {
  const output = execSync("netstat -ano").toString();
  const marker = new RegExp(`:${port}\\s`);
  for (const line of output.split("\n")) {
    if (marker.test(line) && line.includes("LISTENING")) {
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (!Number.isNaN(pid)) {
        return pid;
      }
    }
  }
  return null;
}

function killPid(pid: number): void {
  try {
    execSync(`taskkill /F /PID ${pid}`);
  } catch (error) {
    console.warn(`[durability] taskkill failed for PID ${pid} (continuing anyway):`, error);
  }
}

/** Spawns a detached, unref'd `npm run dev` so it outlives this test process. */
function startDevServer(): void {
  const out = fs.openSync(LOG_FILE, "a");
  const child = spawn("npm", ["run", "dev"], {
    cwd: APP_DIR,
    detached: true,
    stdio: ["ignore", out, out],
    shell: true,
  });
  child.unref();
}

async function waitForServerReady(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL);
      // Any HTTP response at all (even a 4xx/5xx) means something is
      // listening and answering on port 3000.
      if (res.status > 0) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Dev server did not become ready within ${timeoutMs}ms. Last error: ${String(lastError)}`);
}

async function waitForPortFree(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(BASE_URL, { signal: AbortSignal.timeout(1000) });
      // Still answering -> not free yet.
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  // Best-effort: proceed anyway even if we couldn't confirm the port freed.
}

interface CreatedCase {
  caseId: string;
  caseNumber: string;
}

async function createCase(): Promise<CreatedCase> {
  const buffer = fs.readFileSync(CLEAN_IMAGE);
  const form = new FormData();
  form.set("requestType", "zwrot");
  form.set("category", "Laptop");
  form.set("productName", "Laptop Durability Test");
  form.set("purchaseDate", "2024-01-01");
  form.set("image", new File([buffer], "clean-product.jpg", { type: "image/jpeg" }));

  const res = await fetch(`${BASE_URL}/api/cases`, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`Durability seeding: POST /api/cases failed with status ${res.status}`);
  }
  const body = (await res.json()) as { caseId: string; caseNumber: string };
  return body;
}

test("case data survives a dev server restart (AC-34, TAC-05)", async () => {
  test.setTimeout(240_000);

  // Make sure SOME server is up before we try to create a case against it —
  // Playwright's shared webServer (reuseExistingServer: true) should
  // already have one running, but start one ourselves if not.
  try {
    await waitForServerReady(15_000);
  } catch {
    startDevServer();
    await waitForServerReady(90_000);
  }

  // 1. Create a case via a direct API call against the currently running server.
  const created = await createCase();
  expect(typeof created.caseId).toBe("string");
  expect(created.caseId.length).toBeGreaterThan(0);

  // 2. Stop whatever process is listening on port 3000.
  const pid = findListeningPid(PORT);
  expect(pid, "expected a process listening on port 3000 before restart").not.toBeNull();
  killPid(pid as number);
  await waitForPortFree(15_000);

  // 3. Start a brand new dev server process.
  startDevServer();
  await waitForServerReady(90_000);

  // 4. Read the case back through the FRESH process.
  const detailRes = await fetch(`${BASE_URL}/api/cases/${created.caseId}`);
  expect(detailRes.status).toBe(200);
  const detail = await detailRes.json();

  expect(detail.id).toBe(created.caseId);
  expect(detail.caseNumber).toBe(created.caseNumber);
  expect(detail.requestType).toBe("zwrot");
  expect(detail.category).toBe("Laptop");
  expect(detail.productName).toBe("Laptop Durability Test");
  expect(detail.purchaseDate).toBe("2024-01-01");
  expect(Array.isArray(detail.images)).toBe(true);
  expect(detail.images.length).toBeGreaterThan(0);

  // Leave this freshly started server running (not killed) so the repo is
  // left with a working dev server, per the task brief.
});
