import fs from "node:fs";

import { expect, test } from "@playwright/test";

import {
  assertChatSessionMatchesUrl,
  assertDecisionStructure,
  assertNoHorizontalScroll,
  fillRequestForm,
  recentPurchaseDate,
} from "./helpers";

test.use({ browserName: "chromium" });

test.describe("Mobile return happy path", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile-only spec");
  });

  test("submits a return request without horizontal scroll", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    fs.mkdirSync("test-results/manual-mobile", { recursive: true });

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Asystent decyzji serwisowych" }),
    ).toBeVisible();
    await assertNoHorizontalScroll(page);

    await fillRequestForm(page, {
      requestType: "Zwrot",
      category: "Laptop",
      productName: "Lenovo ThinkPad X1",
      purchaseDate: recentPurchaseDate(5),
      imagePath: "e2e/fixtures/clean-product.jpg",
    });

    await page.screenshot({ path: "test-results/manual-mobile/mobile-form.png" });

    await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
    await page.waitForURL(/\/chat\/.+/, { timeout: 60_000 });

    await assertChatSessionMatchesUrl(page);
    const decisionCategory = await assertDecisionStructure(page);
    console.log(`[mobile-return] decision category: ${decisionCategory}`);
    await assertNoHorizontalScroll(page);

    await page.screenshot({ path: "test-results/manual-mobile/mobile-chat.png" });
  });
});
