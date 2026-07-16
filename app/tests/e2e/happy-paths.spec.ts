/**
 * Real-LLM happy-path E2E coverage for the return and complaint flows
 * (PRD flows 4.1/4.2, AC-13/20/24) — task P4.2.
 *
 * Unlike `form-validation.spec.ts` (P4.1), these specs DO reach the real
 * backend and the real OpenRouter models: form submit -> image analysis ->
 * decision agent -> first chat message -> optional follow-up turn. Each
 * scenario is driven exactly ONCE against the real LLM (no retry loops —
 * real calls cost money, per the implementation plan's risk mitigation).
 *
 * The real model's judgment call on image clarity is NOT second-guessed:
 * a scenario is a pass whether the decision arrives directly on the FIRST
 * message, or the model first asks for a better photo (re-upload round)
 * and the decision arrives after that. Assertions on the decision are
 * purely structural (one of the three Polish status labels, a
 * justification section, a next-steps list, and the mandatory disclaimer
 * substring) — never on the exact LLM wording or which of the three
 * statuses was chosen, since that varies by model call.
 *
 * ## Why detection is content-based, not `data-testid="decision-block"`
 * `DecisionBlock` (with `data-testid="decision-block"`) only renders a
 * decision that arrived as a `tool-submitDecision` part over the chat
 * route (a revision, or the decision that follows an in-chat re-upload).
 * The very first decision — the common case, computed synchronously during
 * `POST /api/cases` — is persisted as plain markdown text (see
 * `assembleDecisionMessage` in `src/app/api/cases/route.ts`) and rendered
 * via `MessageResponse`/Streamdown, WITHOUT that test id (confirmed by
 * running this spec against the real app: the complaint flow's first
 * message was a direct "Do weryfikacji przez pracownika" decision with no
 * `decision-block` element in the DOM at all). Both render paths always
 * include the mandatory disclaimer text and a markdown-rendered numbered
 * list (Streamdown turns "1. ..." lines into real `<li>` elements), so this
 * spec detects "a decision message" by finding the assistant message bubble
 * that contains the disclaimer substring, then asserts structure on ITS
 * content — this covers both rendering paths uniformly.
 *
 * Other selectors:
 *  - The re-upload affordance/first message is detected via the instructional
 *    substring `pl.chat.reupload.prompt`, which appears both in the static
 *    composer helper text (`ReuploadPromptInput`, shown while
 *    `showAttachment` is true) and inside the assembled plain-text
 *    "please upload a better photo" first message
 *    (`assembleReuploadMessage`) — either way its presence, WITHOUT the
 *    disclaimer, means the case is awaiting a better photo, never a
 *    decision.
 *  - The hidden file input inside the AI Elements `PromptInput` carries a
 *    fixed `aria-label="Upload files"` (library-owned, not Polish copy);
 *    `setInputFiles` works on it despite it being CSS-hidden.
 *  - Assistant message bubbles carry the `is-assistant` class from
 *    `components/ai-elements/message.tsx`.
 */

import path from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";

import { pl } from "../../src/lib/copy/pl";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const CLEAN_IMAGE = path.join(FIXTURES_DIR, "clean-product.jpg");
const DAMAGED_IMAGE = path.join(FIXTURES_DIR, "damaged-product.jpg");

/** Every real-LLM step in this file gets a generous timeout (>=60s, per plan). */
const LLM_STEP_TIMEOUT = 90_000;
const NAVIGATION_TIMEOUT = 120_000;
/** Overall per-test budget: nav + first wait + possible re-upload round + follow-up. */
const TEST_TIMEOUT = 600_000;

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

function isoDateMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

interface SubmitFormOptions {
  requestType: "zwrot" | "reklamacja";
  category: "Smartfon" | "Laptop";
  productName: string;
  purchaseDateIso: string;
  description?: string;
  imagePath: string;
}

/** Fills the real request form with valid data and submits it (AC-01..07). */
async function submitRequestForm(page: Page, opts: SubmitFormOptions) {
  await page.goto("/");

  await page
    .getByLabel(pl.form.fields.requestType.label)
    .selectOption({ label: pl.form.fields.requestType.options[opts.requestType] });
  await page
    .getByLabel(pl.form.fields.category.label)
    .selectOption({ label: pl.form.fields.category.options[opts.category] });
  await page.getByLabel(pl.form.fields.productName.label).fill(opts.productName);
  await page.getByLabel(pl.form.fields.purchaseDate.label).fill(opts.purchaseDateIso);

  if (opts.description) {
    const descriptionLabel =
      opts.requestType === "reklamacja"
        ? pl.form.fields.description.labelRequired
        : pl.form.fields.description.labelOptional;
    await page.getByLabel(descriptionLabel).fill(opts.description);
  }

  await page.getByLabel(pl.form.fields.image.label).setInputFiles(opts.imagePath);
  await page.getByRole("button", { name: pl.form.submitButton }).click();

  await page.waitForURL(/\/chat\//, { timeout: NAVIGATION_TIMEOUT });
}

/**
 * The assistant message bubble carrying a decision, if any: the mandatory
 * disclaimer is present in a decision message on EITHER render path (plain
 * first-message text or a tool-rendered `DecisionBlock`) and on no other
 * message kind, so it is a reliable, render-path-agnostic anchor.
 */
function decisionMessageLocator(page: Page): Locator {
  return page.locator(".is-assistant").filter({ hasText: pl.chat.disclaimer }).last();
}

/**
 * Races the two possible outcomes of the (already-computed, by navigation
 * time) initial AI pipeline result: a decision message, or the re-upload
 * prompt. Whichever becomes visible first wins; the other promise's
 * eventual timeout is swallowed so it never surfaces as an unhandled
 * rejection.
 */
async function waitForDecisionOrReupload(
  page: Page,
  timeoutMs: number,
): Promise<"decision" | "reupload"> {
  const decision = decisionMessageLocator(page);
  const reupload = page.getByText(pl.chat.reupload.prompt, { exact: false }).first();

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
      "Neither a decision message nor the re-upload prompt appeared within the timeout.",
    );
  }
  return result;
}

/** Uploads one "better photo" in the chat composer and sends it (AC-14, flow 4.3). */
async function sendReuploadPhoto(page: Page, imagePath: string, message: string) {
  await page.getByLabel("Upload files").setInputFiles(imagePath);
  const textarea = page.getByPlaceholder(pl.chat.inputPlaceholder);
  await textarea.fill(message);
  await textarea.press("Enter");
}

/**
 * Structural assertions for the decision message (AC-13/20) — never asserts
 * exact wording or which status was chosen, only that all mandated parts
 * are present: one of the three Polish status labels, a justification
 * section, a non-empty next-steps list, and the disclaimer.
 */
async function assertDecisionMessageStructure(page: Page): Promise<string> {
  const message = decisionMessageLocator(page);
  await expect(message).toBeVisible();

  const text = await message.innerText();

  const statusLabels = Object.values(pl.chat.decisionLabels);
  const matchedStatus = statusLabels.find((label) => text.includes(label));
  expect(
    matchedStatus,
    `decision message should contain one of: ${statusLabels.join(", ")}`,
  ).toBeTruthy();

  expect(text).toContain(pl.chat.greeting.justificationHeading);
  expect(text).toContain(pl.chat.greeting.nextStepsHeading);
  expect(text).toContain(pl.chat.disclaimer);

  // Next steps render as a real list on both paths: Streamdown parses the
  // "1. ...\n2. ..." markdown of the plain-text first message into <li>s,
  // and DecisionBlock renders an explicit <ol><li> (see file header).
  const stepsCount = await message.locator("li").count();
  expect(stepsCount).toBeGreaterThan(0);

  return matchedStatus as string;
}

/** Sends a follow-up chat question and asserts a new, non-empty assistant reply arrives (AC-24). */
async function assertFollowUpReply(page: Page, question: string) {
  const assistantMessages = page.locator(".is-assistant");
  const countBefore = await assistantMessages.count();

  const textarea = page.getByPlaceholder(pl.chat.inputPlaceholder);
  await textarea.fill(question);
  await textarea.press("Enter");

  await expect(assistantMessages).toHaveCount(countBefore + 1, {
    timeout: LLM_STEP_TIMEOUT,
  });

  const newMessage = assistantMessages.nth(countBefore);
  await expect
    .poll(async () => (await newMessage.innerText()).trim().length, {
      timeout: LLM_STEP_TIMEOUT,
    })
    .toBeGreaterThan(0);
}

test.describe.configure({ mode: "serial" });

test.describe("Happy paths with the real LLM (PRD flows 4.1/4.2)", () => {
  test("return flow: valid form + clean photo -> decision -> follow-up reply", async ({
    page,
    consoleErrors,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    await submitRequestForm(page, {
      requestType: "zwrot",
      category: "Laptop",
      productName: "Laptop XPS 13",
      purchaseDateIso: isoDateDaysAgo(5),
      imagePath: CLEAN_IMAGE,
    });

    const outcome = await waitForDecisionOrReupload(page, LLM_STEP_TIMEOUT);

    if (outcome === "reupload") {
      await sendReuploadPhoto(
        page,
        CLEAN_IMAGE,
        "Oto lepsze zdjęcie sprzętu, proszę ponownie ocenić zgłoszenie.",
      );
      await expect(decisionMessageLocator(page)).toBeVisible({ timeout: LLM_STEP_TIMEOUT });
    }

    const status = await assertDecisionMessageStructure(page);
    // Informational only — never asserted on, the real LLM's status choice varies.
    console.log(`[happy-paths] return flow: re-upload=${outcome === "reupload"}, status="${status}"`);

    await assertFollowUpReply(page, "Co powinienem teraz zrobić?");

    expect(consoleErrors).toEqual([]);
  });

  test("complaint flow: valid form + damaged photo + defect description -> decision -> follow-up reply", async ({
    page,
    consoleErrors,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    await submitRequestForm(page, {
      requestType: "reklamacja",
      category: "Laptop",
      productName: "Laptop XPS 13",
      purchaseDateIso: isoDateMonthsAgo(8),
      description: "Pęknięty zawias przy normalnym użytkowaniu, laptop trzaska podczas otwierania.",
      imagePath: DAMAGED_IMAGE,
    });

    const outcome = await waitForDecisionOrReupload(page, LLM_STEP_TIMEOUT);

    if (outcome === "reupload") {
      await sendReuploadPhoto(
        page,
        DAMAGED_IMAGE,
        "Oto lepsze zdjęcie uszkodzenia, proszę ponownie ocenić zgłoszenie.",
      );
      await expect(decisionMessageLocator(page)).toBeVisible({ timeout: LLM_STEP_TIMEOUT });
    }

    const status = await assertDecisionMessageStructure(page);
    // Informational only — never asserted on, the real LLM's status choice varies.
    console.log(`[happy-paths] complaint flow: re-upload=${outcome === "reupload"}, status="${status}"`);

    await assertFollowUpReply(page, "Czy mogę jeszcze coś dołączyć do zgłoszenia?");

    expect(consoleErrors).toEqual([]);
  });
});
