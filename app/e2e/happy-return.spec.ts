import { expect, test } from "@playwright/test";

import {
  assertChatSessionMatchesUrl,
  assertDecisionStructure,
  fillRequestForm,
  recentPurchaseDate,
} from "./helpers";

test.describe("Return happy path", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only spec");
  });

  test("submits a return request and completes a follow-up chat round-trip", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Asystent decyzji serwisowych" }),
    ).toBeVisible();

    await fillRequestForm(page, {
      requestType: "Zwrot",
      category: "Laptop",
      productName: "Lenovo ThinkPad X1",
      purchaseDate: recentPurchaseDate(5),
      imagePath: "e2e/fixtures/clean-product.jpg",
    });

    await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
    await page.waitForURL(/\/chat\/.+/, { timeout: 60_000 });

    await assertChatSessionMatchesUrl(page);
    const decisionCategory = await assertDecisionStructure(page);
    console.log(`[happy-return] decision category: ${decisionCategory}`);

    const chatInput = page.getByLabel("Napisz wiadomość…");
    const sendButton = page.getByRole("button", { name: "Wyślij" });
    const typingIndicator = page.getByLabel("Asystent pisze…");

    await chatInput.fill("Czy mogę jeszcze dołączyć paragon?");
    await sendButton.click();
    await expect(typingIndicator).toBeVisible({ timeout: 10_000 });
    await expect(sendButton).toBeDisabled();
    await expect(typingIndicator).toBeHidden({ timeout: 60_000 });

    await expect.poll(
      async () => page.locator('[data-role="assistant"]').count(),
      { timeout: 60_000 },
    ).toBeGreaterThanOrEqual(2);

    await expect(chatInput).toBeEnabled();
    await chatInput.fill("Dziękuję.");
    await expect(sendButton).toBeEnabled();
  });
});
