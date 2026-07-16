/**
 * Reviewer list + case-detail E2E coverage (PRD §9.3, AC-40/41/42;
 * ADR-004 §3/§6; TAC-004-04) — task P4.3.
 *
 * ## Seeding strategy: direct API calls, not a full chat-UI drive
 * Driving a `needs_human_review` case end-to-end through the browser
 * (submit form -> wait for the real re-upload prompt -> upload a second
 * photo in chat -> wait for a real forced escalation) would work — see
 * `reupload-escalation.spec.ts`, which does drive that real flow once — but
 * it is slower and NOT guaranteed to land on `needs_human_review`: whether
 * the SECOND analysis also comes back inconclusive is still up to the real
 * vision model on that run. Since this spec needs a reliably escalated case
 * to test the reviewer views against, it seeds one via two direct HTTP
 * calls that exercise the exact same production code paths, with no
 * mocking (still "real stack", per the E2E test-strategy rule):
 *
 *   1. `POST /api/cases` (multipart, real `fetch`, no browser) with
 *      `clean-product.jpg` — confirmed empirically THIS SESSION to read as
 *      "inconclusive" to the real vision model 8/8 times (qa-engineer
 *      memory: `playwright-e2e-chat-decision-patterns.md`), so the first
 *      analysis is almost certainly inconclusive.
 *   2. `POST /api/cases/[caseId]/chat` (JSON, real `fetch`) with a synthetic
 *      user message carrying an inline `data:` URL image part built from
 *      the SAME fixture — exactly the re-upload path
 *      `src/lib/ai/stream-chat.ts` implements for a real chat re-upload. Per
 *      that file's own AC-14 logic, a SECOND inconclusive analysis forces
 *      `needs_human_review` via `toolChoice: "required"` plus a hardcoded
 *      `forcedStatus` — a structural guarantee in production code, not a
 *      test assumption.
 *
 * `seedEscalatedCase()` retries step 2 (re-sending the same fixture as a
 * fresh "chat re-upload") up to `MAX_REUPLOAD_ATTEMPTS` times if an earlier
 * attempt happens to come back conclusive, bounding the real-model cost
 * while making eventual escalation near-certain.
 *
 * The browser is only used to look at the two reviewer pages under test —
 * seeding itself never opens a page.
 *
 * ## Empty-state sub-case (`pl.reviewer.emptyState`) — not covered here
 * The task allows skipping this if it is genuinely impractical without DB
 * isolation infrastructure that doesn't exist yet. It is skipped: the dev
 * SQLite DB is shared across every E2E spec in this suite (P4.2's happy
 * paths and this file's own seeding both add escalatable cases to it), so
 * there is no cheap way to assert "the list is empty" without dedicated
 * per-test DB isolation, which is out of scope for this task.
 */

import fs from "node:fs";
import path from "node:path";
import { test as base, expect } from "@playwright/test";

import { pl } from "../../src/lib/copy/pl";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const CLEAN_IMAGE = path.join(FIXTURES_DIR, "clean-product.jpg");

const BASE_URL = "http://localhost:3000";
const MAX_REUPLOAD_ATTEMPTS = 3;
const SEED_TIMEOUT = 300_000;

interface SeededCase {
  caseId: string;
  caseNumber: string;
  productName: string;
  category: string;
  requestType: "zwrot" | "reklamacja";
}

interface CaseDetailResponse {
  id: string;
  caseNumber: string;
  requestType: "zwrot" | "reklamacja";
  category: string;
  productName: string;
  needsReview: boolean;
}

/** Creates a case via a direct multipart POST — no browser needed for seeding. */
async function createCase(): Promise<{ caseId: string; caseNumber: string }> {
  const buffer = fs.readFileSync(CLEAN_IMAGE);
  const form = new FormData();
  form.set("requestType", "reklamacja");
  form.set("category", "Laptop");
  form.set("productName", "Laptop Reviewer Seed");
  form.set("purchaseDate", "2024-03-01");
  form.set("description", "Uszkodzona obudowa, pęknięcie w rogu przy normalnym użytkowaniu.");
  form.set("image", new File([buffer], "clean-product.jpg", { type: "image/jpeg" }));

  const res = await fetch(`${BASE_URL}/api/cases`, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`Seeding: POST /api/cases failed with status ${res.status}`);
  }
  const body = (await res.json()) as { caseId: string; caseNumber: string };
  return { caseId: body.caseId, caseNumber: body.caseNumber };
}

/** Sends one chat "re-upload" turn (same real code path as a live chat re-upload). */
async function sendChatReupload(caseId: string): Promise<void> {
  const buffer = fs.readFileSync(CLEAN_IMAGE);
  const base64 = buffer.toString("base64");
  const messages = [
    {
      id: `seed-reupload-${Date.now()}`,
      role: "user",
      parts: [
        { type: "text", text: "Oto kolejne zdjęcie do analizy." },
        {
          type: "file",
          mediaType: "image/jpeg",
          filename: "clean-product.jpg",
          url: `data:image/jpeg;base64,${base64}`,
        },
      ],
    },
  ];

  const res = await fetch(`${BASE_URL}/api/cases/${caseId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    throw new Error(`Seeding: POST /api/cases/${caseId}/chat failed with status ${res.status}`);
  }
  // Drain the stream so the route's onFinish callback persists the turn
  // (the fresh analysis + any decision) before the next check runs.
  await res.text();
}

async function fetchCaseDetail(caseId: string): Promise<CaseDetailResponse> {
  const res = await fetch(`${BASE_URL}/api/cases/${caseId}`);
  if (!res.ok) {
    throw new Error(`Seeding: GET /api/cases/${caseId} failed with status ${res.status}`);
  }
  return res.json();
}

/** Seeds one guaranteed `needs_human_review` case — see file header for why this is deterministic. */
async function seedEscalatedCase(): Promise<SeededCase> {
  const { caseId, caseNumber } = await createCase();

  let detail = await fetchCaseDetail(caseId);
  for (let attempt = 0; attempt < MAX_REUPLOAD_ATTEMPTS && !detail.needsReview; attempt += 1) {
    await sendChatReupload(caseId);
    detail = await fetchCaseDetail(caseId);
  }

  if (!detail.needsReview) {
    throw new Error(
      `Seeding did not reach needs_human_review after ${MAX_REUPLOAD_ATTEMPTS} chat re-upload ` +
        "attempt(s) — the real vision model did not judge the fixture inconclusive enough " +
        "times in a row on this run.",
    );
  }

  return {
    caseId,
    caseNumber,
    productName: detail.productName,
    category: detail.category,
    requestType: detail.requestType,
  };
}

const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(String(err)));
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(errors);
  },
});

test.describe.configure({ mode: "serial" });

test.describe("Reviewer pages (PRD §9.3, AC-40/41/42)", () => {
  // Populated by the first test; the second test depends on it. `serial`
  // mode means a failure in the first test skips the second rather than
  // failing on an undefined `seeded`.
  let seeded!: SeededCase;

  test("escalated cases list shows the seeded case with AC-41 columns", async ({
    page,
    consoleErrors,
  }) => {
    test.setTimeout(SEED_TIMEOUT);

    seeded = await seedEscalatedCase();

    await page.goto("/reviewer");

    await expect(page.getByRole("heading", { name: pl.reviewer.listTitle })).toBeVisible();

    const link = page.getByRole("link", { name: seeded.caseNumber, exact: true });
    await expect(link).toBeVisible();

    const row = page.locator("tr", { has: link });
    await expect(row).toContainText(pl.form.fields.requestType.options[seeded.requestType]);
    await expect(row).toContainText(seeded.category);
    await expect(row).toContainText(seeded.productName);

    expect(consoleErrors).toEqual([]);
  });

  test("case detail shows form data, image, decision history and transcript, with no interactive elements besides the back link", async ({
    page,
    consoleErrors,
  }) => {
    await page.goto(`/reviewer/${seeded.caseId}`);

    await expect(
      page.getByRole("heading", { name: pl.reviewer.detail.formDataHeading }),
    ).toBeVisible();
    await expect(page.getByText(seeded.productName)).toBeVisible();
    await expect(
      page.getByText(pl.chat.decisionLabels.doWeryfikacji, { exact: true }).first(),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: pl.reviewer.detail.imageHeading }),
    ).toBeVisible();
    await expect(page.locator("img").first()).toBeVisible();

    await expect(
      page.getByRole("heading", { name: pl.reviewer.detail.decisionHistoryHeading }),
    ).toBeVisible();
    await expect(page.getByTestId("decision-block").first()).toBeVisible();

    await expect(
      page.getByRole("heading", { name: pl.reviewer.detail.transcriptHeading }),
    ).toBeVisible();

    // TAC-004-04: entirely read-only — the only interactive element on this
    // page is the back-navigation link, which must be an <a>, never a
    // <button>/<input>/<form> (CaseDetailView's `Button asChild` renders as
    // a plain anchor via Radix `Slot`, confirmed by reading button.tsx).
    // Scoped to CaseDetailView's own root container, NOT the whole page:
    // Next.js's dev-only floating "Open Next.js Dev Tools" button renders as
    // a real page-level <button> sibling outside the app content (same class
    // of dev-chrome false positive as the role="alert" overlay documented in
    // qa-engineer memory: playwright-e2e-form-patterns.md), so an unscoped
    // `page.locator("button")` count would wrongly fail here too.
    const content = page.locator("div.mx-auto.max-w-3xl");
    await expect(content.locator("button")).toHaveCount(0);
    await expect(content.locator("input")).toHaveCount(0);
    await expect(content.locator("form")).toHaveCount(0);
    await expect(content.getByRole("link", { name: pl.reviewer.backButton })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});
