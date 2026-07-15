import { expect, test } from "@playwright/test";

/**
 * Placeholder smoke spec for T1.7 (Playwright infrastructure only).
 *
 * The request form (ADR-002 §3 "Form area", PRD screen 9.1) does not exist
 * yet — the app currently serves the bootstrap scaffold page from
 * `src/app/page.tsx`. This spec only proves the webServer-started app boots
 * and serves that scaffold, so the E2E suite stays green until the real form
 * ships.
 *
 * TODO(frontend): once `RequestForm` ships, delete the scaffold-heading
 * assertion below, remove the `test.skip(...)` guard on the second test, and
 * assert the real form fields instead: request-type select, category select,
 * product name input, purchase-date picker, reason textarea, image drop
 * zone (ADR-002 §3).
 */
test.describe("App smoke test", () => {
  test("root route loads and serves the current scaffold page", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Asystent decyzji serwisowych" })
    ).toBeVisible();
  });

  test("request form is visible with its required fields", async ({
    page,
  }) => {
    test.skip(
      true,
      "Request form not implemented yet (ADR-002 §3 / PRD screen 9.1) — " +
        "enable this test once RequestForm ships."
    );

    await page.goto("/");
    // TODO: assert request-type select, category select, product name
    // input, purchase-date picker, reason textarea, image drop zone.
  });
});
