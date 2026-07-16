/**
 * E2E coverage for the request form (start screen) — PRD §9.1, AC-01..06,
 * AC-50/51 — driven against the real running app with the real Zod schema
 * (`src/lib/validation/case-form.schema.ts`) and real Polish copy
 * (`src/lib/copy/pl.ts`). The LLM/backend is never reached: every scenario
 * here is either a pure client-side validation failure (no `fetch` call at
 * all) or a fully valid fill that stops short of clicking submit, so
 * `POST /api/cases` — and the AI pipeline behind it — is never invoked
 * (P4.1 is designed to run with no `OPENROUTER_API_KEY`).
 *
 * Selectors follow the same house style as `tests/unit/request-form.test.tsx`:
 * accessible roles/labels, with the exact Polish strings imported from
 * `pl.ts` (never re-typed as literals) so a copy change cannot silently
 * desync the suite from the UI.
 */

import path from "node:path";
import { test as base, expect, type Page } from "@playwright/test";

import { pl } from "../../src/lib/copy/pl";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const CLEAN_IMAGE = path.join(FIXTURES_DIR, "clean-product.jpg");
const OVERSIZED_IMAGE = path.join(FIXTURES_DIR, "oversized.jpg");
const WRONG_TYPE_IMAGE = path.join(FIXTURES_DIR, "wrong-type.gif");

type FormField = "requestType" | "category" | "productName" | "purchaseDate" | "image";

/**
 * Fixture-based test extension:
 *  - `consoleErrors` collects every `console.error`/uncaught page error, so
 *    each scenario can assert zero console errors (task requirement).
 *  - `casesRequests` records every request that hits `/api/cases`, so
 *    AC-06 scenarios can assert the backend/AI pipeline was never called.
 */
const test = base.extend<{ consoleErrors: string[]; casesRequests: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(String(err)));
    // Playwright's fixture-teardown parameter is literally named `use`; the
    // react-hooks lint rule mistakes this for React's `use()` hook.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(errors);
  },
  casesRequests: async ({ page }, use) => {
    const calls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/cases")) calls.push(request.url());
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(calls);
  },
});

async function fillRequestType(page: Page, value: "zwrot" | "reklamacja") {
  await page
    .getByLabel(pl.form.fields.requestType.label)
    .selectOption({ label: pl.form.fields.requestType.options[value] });
}

async function fillCategory(page: Page, value: "Smartfon" | "Laptop") {
  await page
    .getByLabel(pl.form.fields.category.label)
    .selectOption({ label: pl.form.fields.category.options[value] });
}

async function fillProductName(page: Page, value: string) {
  await page.getByLabel(pl.form.fields.productName.label).fill(value);
}

async function fillPurchaseDate(page: Page, isoDate: string) {
  await page.getByLabel(pl.form.fields.purchaseDate.label).fill(isoDate);
}

async function uploadImage(page: Page, filePath: string) {
  await page.getByLabel(pl.form.fields.image.label).setInputFiles(filePath);
}

function submitButton(page: Page) {
  return page.getByRole("button", { name: pl.form.submitButton });
}

/** Fills every required field with valid values (mirrors the unit-test fixture), leaving one out. */
async function fillValidFormExcept(page: Page, skip: FormField | null, imagePath: string) {
  if (skip !== "requestType") await fillRequestType(page, "zwrot");
  if (skip !== "category") await fillCategory(page, "Laptop");
  if (skip !== "productName") await fillProductName(page, "Laptop XPS 13");
  if (skip !== "purchaseDate") await fillPurchaseDate(page, "2020-01-01");
  if (skip !== "image") await uploadImage(page, imagePath);
}

test.describe("Request form — required field validation (AC-06)", () => {
  const cases: Array<{ name: string; skip: FormField; expectedMessage: string }> = [
    {
      name: "rodzaj zgłoszenia",
      skip: "requestType",
      expectedMessage: pl.form.errors.requestTypeRequired,
    },
    {
      name: "kategoria sprzętu",
      skip: "category",
      expectedMessage: pl.form.errors.categoryRequired,
    },
    {
      name: "nazwa / model produktu",
      skip: "productName",
      expectedMessage: pl.form.errors.productNameRequired,
    },
    {
      name: "data zakupu",
      skip: "purchaseDate",
      expectedMessage: pl.form.errors.purchaseDateInvalid,
    },
    {
      name: "zdjęcie sprzętu",
      skip: "image",
      expectedMessage: pl.form.errors.imageRequired,
    },
  ];

  for (const { name, skip, expectedMessage } of cases) {
    test(`shows the inline error and makes no backend call when "${name}" is left empty`, async ({
      page,
      consoleErrors,
      casesRequests,
    }) => {
      await page.goto("/");
      await fillValidFormExcept(page, skip, CLEAN_IMAGE);

      await submitButton(page).click();

      await expect(page.getByText(expectedMessage, { exact: true })).toBeVisible();
      expect(casesRequests).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  }
});

test.describe("Request form — purchase date (AC-04)", () => {
  test("blocks submission with an inline error on a future purchase date, without calling the backend", async ({
    page,
    consoleErrors,
    casesRequests,
  }) => {
    await page.goto("/");
    await fillValidFormExcept(page, null, CLEAN_IMAGE);

    const future = new Date();
    future.setDate(future.getDate() + 5);
    const futureIso = future.toISOString().slice(0, 10);
    await fillPurchaseDate(page, futureIso);

    // Reactive: the error appears immediately on change, before any submit attempt.
    await expect(page.getByText(pl.form.errors.purchaseDateFuture, { exact: true })).toBeVisible();

    await submitButton(page).click();

    await expect(page.getByText(pl.form.errors.purchaseDateFuture, { exact: true })).toBeVisible();
    expect(casesRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});

test.describe("Request form — image constraints (AC-05)", () => {
  test("rejects an oversized image (> 10 MB) with an inline error naming the size limit, before any network call", async ({
    page,
    consoleErrors,
    casesRequests,
  }) => {
    await page.goto("/");
    await fillValidFormExcept(page, "image", CLEAN_IMAGE);
    await uploadImage(page, OVERSIZED_IMAGE);

    // Rejected immediately, before any submit attempt (AC-05).
    await expect(page.getByText(pl.form.errors.imageTooLarge, { exact: true })).toBeVisible();

    // Attempting to submit with no accepted image re-runs full validation,
    // which now (correctly) reports the image as missing rather than
    // repeating the same "too large" wording — either way, no image was
    // ever accepted and no backend call is made.
    await submitButton(page).click();

    await expect(page.locator("form").getByRole("alert").filter({ hasText: "zdjęci" })).toBeVisible();
    expect(casesRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("rejects a wrong-type file (GIF) with an inline error naming the format constraint, before any network call", async ({
    page,
    consoleErrors,
    casesRequests,
  }) => {
    await page.goto("/");
    await fillValidFormExcept(page, "image", CLEAN_IMAGE);
    await uploadImage(page, WRONG_TYPE_IMAGE);

    // Rejected immediately, before any submit attempt (AC-05).
    await expect(page.getByText(pl.form.errors.imageInvalidType, { exact: true })).toBeVisible();

    // Attempting to submit with no accepted image re-runs full validation,
    // which now (correctly) reports the image as missing rather than
    // repeating the same "wrong format" wording — either way, no image was
    // ever accepted and no backend call is made.
    await submitButton(page).click();

    await expect(page.locator("form").getByRole("alert").filter({ hasText: "zdjęci" })).toBeVisible();
    expect(casesRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});

test.describe("Request form — description required/optional toggle (AC-03)", () => {
  test("toggles the description label and helper text reactively with request type", async ({
    page,
    consoleErrors,
  }) => {
    await page.goto("/");

    await expect(page.getByLabel(pl.form.fields.description.labelOptional)).toBeVisible();
    await expect(page.getByText(pl.form.fields.description.helperReturn)).toBeVisible();

    await fillRequestType(page, "reklamacja");

    await expect(page.getByLabel(pl.form.fields.description.labelRequired)).toBeVisible();
    await expect(page.getByText(pl.form.fields.description.helperComplaint)).toBeVisible();

    await fillRequestType(page, "zwrot");

    await expect(page.getByLabel(pl.form.fields.description.labelOptional)).toBeVisible();
    await expect(page.getByText(pl.form.fields.description.helperReturn)).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});

test.describe("Request form — valid fill (client validation only, no submit)", () => {
  test("a fully valid fill enables the submit button with no blocking inline errors", async ({
    page,
    consoleErrors,
    casesRequests,
  }) => {
    await page.goto("/");
    await fillValidFormExcept(page, null, CLEAN_IMAGE);

    // Client validation passes: the submit action is available and no
    // inline error (role="alert") is showing anywhere on the form. Scoped
    // to the <form> — the page may render unrelated framework UI (e.g. the
    // Next.js dev tools overlay) that also happens to use role="alert".
    await expect(submitButton(page)).toBeEnabled();
    await expect(page.locator("form").getByRole("alert")).toHaveCount(0);

    // Never actually submit — that would hit the (key-less) AI pipeline.
    expect(casesRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});

test.describe("Request form — mobile viewport (AC-51)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("renders the form usably at 390px width with no horizontal overflow", async ({
    page,
    consoleErrors,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: pl.form.title })).toBeVisible();
    await expect(page.getByLabel(pl.form.fields.requestType.label)).toBeVisible();
    await expect(page.getByLabel(pl.form.fields.category.label)).toBeVisible();
    await expect(page.getByLabel(pl.form.fields.productName.label)).toBeVisible();
    await expect(page.getByLabel(pl.form.fields.purchaseDate.label)).toBeVisible();
    await expect(page.getByLabel(pl.form.fields.image.label)).toBeVisible();
    await expect(submitButton(page)).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    expect(consoleErrors).toEqual([]);
  });
});

test.describe("Request form — page load", () => {
  test("loads with zero console errors", async ({ page, consoleErrors }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: pl.form.title })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
