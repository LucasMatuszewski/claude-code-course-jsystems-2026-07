/**
 * Re-upload + escalation E2E coverage (PRD flow 4.3, AC-14/22; ADR-004 §3
 * "Re-upload control"; TAC-004-02) — task P4.3.
 *
 * Drives the real backend and real OpenRouter models exactly once: submits
 * the `blurry.jpg` fixture (heavy gaussian blur — chosen per this task's
 * brief as the fixture most likely to read as "inconclusive" to the vision
 * model), then branches on whatever the model actually decides:
 *
 *  - If the model asks for a better photo (the empirically likely outcome
 *    per qa-engineer memory `playwright-e2e-chat-decision-patterns.md`,
 *    which found `clean-product.jpg` judged inconclusive 8/8 times this
 *    session — a heavily blurred photo is at least as likely to be flagged),
 *    this spec exercises the real re-upload control (AC-22): uploads
 *    `clean-product.jpg` in the chat composer and waits for the resulting
 *    decision.
 *  - If the model instead judges the blurry photo conclusive on the very
 *    first try (possible, just less likely), the spec still passes: it
 *    asserts a decision block arrived and skips the re-upload-specific
 *    assertions for THIS run via a plain `if` (not `test.skip`), so a single
 *    execution always exercises whichever real path the model took, and
 *    only the exercised path is ever asserted on.
 *
 * No status (approved/rejected/needs_human_review) is ever asserted — all
 * three are valid real-model outcomes; only structure is checked.
 *
 * ## "A decision has arrived" signal
 * After the AC-20 defect fix (`dd69b98`), the FIRST decision — computed
 * synchronously inside `POST /api/cases`, the common no-re-upload case — is
 * now persisted with the same `tool-submitDecision` output-part shape a
 * streamed decision uses (see `assembleDecisionMessageParts` in
 * `src/app/api/cases/route.ts`), so `DecisionBlock`'s
 * `data-testid="decision-block"` renders for EVERY decision, first or
 * later. This spec therefore uses `page.getByTestId("decision-block")`
 * directly, unlike the pre-fix disclaimer-substring workaround
 * `happy-paths.spec.ts` (P4.2) still uses and does not need to be touched
 * for.
 *
 * ## "Attachment control is showing" signal
 * The composer's underlying native file input (`aria-label="Upload files"`,
 * from the AI Elements `PromptInput` primitive) is rendered UNCONDITIONALLY
 * regardless of whether a re-upload is actually being requested (confirmed
 * by reading `src/components/ai-elements/prompt-input.tsx`) — it is never a
 * valid "is the re-upload affordance showing" signal, even though it is a
 * perfectly fine target for `setInputFiles` (which does not require
 * visibility). The actual customer-visible affordance that is conditionally
 * rendered on `showAttachment` is `ReuploadPromptInput`'s `AttachButton`, an
 * accessible button labelled with `pl.chat.reupload.prompt` — this spec
 * asserts THAT element's presence/absence for AC-22 / TAC-004-02.
 */

import path from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";

import { pl } from "../../src/lib/copy/pl";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const BLURRY_IMAGE = path.join(FIXTURES_DIR, "blurry.jpg");
const CLEAN_IMAGE = path.join(FIXTURES_DIR, "clean-product.jpg");

/** Every real-LLM step gets a generous timeout (>=60s, per the implementation plan). */
const LLM_STEP_TIMEOUT = 90_000;
const NAVIGATION_TIMEOUT = 120_000;
const TEST_TIMEOUT = 300_000;

const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(String(err)));
    // Playwright's fixture-teardown parameter is literally named `use`; the
    // react-hooks lint rule mistakes this for React's `use()` hook (see
    // qa-engineer memory: playwright-e2e-form-patterns.md).
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(errors);
  },
});

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Fills and submits the real request form (AC-01..07) with the blurry fixture. */
async function submitRequestForm(page: Page, imagePath: string) {
  await page.goto("/");

  await page
    .getByLabel(pl.form.fields.requestType.label)
    .selectOption({ label: pl.form.fields.requestType.options.zwrot });
  await page
    .getByLabel(pl.form.fields.category.label)
    .selectOption({ label: pl.form.fields.category.options.Smartfon });
  await page.getByLabel(pl.form.fields.productName.label).fill("Smartfon Galaxy S23");
  await page.getByLabel(pl.form.fields.purchaseDate.label).fill(isoDateDaysAgo(10));
  await page.getByLabel(pl.form.fields.image.label).setInputFiles(imagePath);
  await page.getByRole("button", { name: pl.form.submitButton }).click();

  await page.waitForURL(/\/chat\//, { timeout: NAVIGATION_TIMEOUT });
}

/** The (latest) decision block — reliable for both render paths since the AC-20 fix. */
function decisionBlockLocator(page: Page): Locator {
  return page.getByTestId("decision-block").last();
}

/** The customer-visible attach-photo button, shown only while `showAttachment` is true. */
function attachButtonLocator(page: Page): Locator {
  return page.getByRole("button", { name: pl.chat.reupload.prompt, exact: true });
}

/** Races the two possible outcomes of the already-computed initial pipeline result. */
async function waitForDecisionOrReupload(
  page: Page,
  timeoutMs: number,
): Promise<"decision" | "reupload"> {
  const decision = decisionBlockLocator(page);
  const reupload = attachButtonLocator(page);

  const decisionSettled = decision
    .waitFor({ state: "visible", timeout: timeoutMs })
    .then(() => "decision" as const)
    .catch(() => null);
  const reuploadSettled = reupload
    .waitFor({ state: "visible", timeout: timeoutMs })
    .then(() => "reupload" as const)
    .catch(() => null);

  const result = await Promise.race([decisionSettled, reuploadSettled]);
  if (!result) {
    throw new Error(
      "Neither a decision block nor the re-upload attach button appeared within the timeout.",
    );
  }
  return result;
}

test.describe.configure({ mode: "serial" });

test.describe("Re-upload and escalation (PRD flow 4.3, AC-14/22)", () => {
  test("blurry photo -> re-upload control (if requested) -> better photo -> decision arrives, control disappears", async ({
    page,
    consoleErrors,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    await submitRequestForm(page, BLURRY_IMAGE);

    const outcome = await waitForDecisionOrReupload(page, LLM_STEP_TIMEOUT);

    if (outcome === "reupload") {
      // AC-22: the attach control is present while a better photo is requested.
      await expect(attachButtonLocator(page)).toBeVisible();

      await page.getByLabel("Upload files").setInputFiles(CLEAN_IMAGE);
      const textarea = page.getByPlaceholder(pl.chat.inputPlaceholder);
      await textarea.fill("Oto lepsze zdjęcie sprzętu, proszę ponownie ocenić zgłoszenie.");
      await textarea.press("Enter");

      await expect(decisionBlockLocator(page)).toBeVisible({ timeout: LLM_STEP_TIMEOUT });

      // TAC-004-02: the control disappears once a decision has been issued
      // (a re-upload always ends in a decision — see ChatShell's derivation).
      await expect(attachButtonLocator(page)).toBeHidden();
    } else {
      // The model judged the blurry photo conclusive on the first try — a
      // valid, if less likely, real outcome (see file header). The
      // re-upload-specific assertions above are skipped for this run since
      // there was nothing to re-upload; the decision itself is still
      // structurally verified below.
      await expect(decisionBlockLocator(page)).toBeVisible();
    }

    // Informational only — never asserted on, this varies with the real model.
    console.log(`[reupload-escalation] outcome=${outcome}`);

    expect(consoleErrors).toEqual([]);
  });
});
