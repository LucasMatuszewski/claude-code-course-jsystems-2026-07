import { test } from "@playwright/test";

import {
  assertChatSessionMatchesUrl,
  assertDecisionStructure,
  fillRequestForm,
  recentPurchaseDate,
} from "./helpers";

test.describe("Complaint happy path", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only spec");
  });

  test("submits a complaint request and shows a structured decision", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await page.goto("/");
    await fillRequestForm(page, {
      requestType: "Reklamacja",
      category: "Smartfon",
      productName: "iPhone 13",
      purchaseDate: recentPurchaseDate(10),
      reason:
        "Ekran telefonu jest pęknięty, uszkodzenie pojawiło się po przypadkowym upuszczeniu.",
      imagePath: "e2e/fixtures/damaged-product.jpg",
    });

    await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
    await page.waitForURL(/\/chat\/.+/, { timeout: 60_000 });

    await assertChatSessionMatchesUrl(page);
    const decisionCategory = await assertDecisionStructure(page);
    console.log(`[happy-complaint] decision category: ${decisionCategory}`);

    const decisionText =
      (await page.getByTestId("decision-block").textContent()) ?? "";
    console.log(`[happy-complaint] decision text: ${decisionText.trim()}`);
  });
});
