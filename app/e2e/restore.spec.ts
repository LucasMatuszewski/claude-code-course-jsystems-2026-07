import { expect, test } from "@playwright/test";

import {
  canonicalTranscript,
  recentPurchaseDate,
  sendChatTurn,
  submitRequestAndWaitForDecision,
} from "./helpers";

test.describe("E2E edge cases: restore", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only real-LLM spec");
  });

  test("AC-27 restores the full transcript after two chat turns", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const decisionCategory = await submitRequestAndWaitForDecision(page, {
      requestType: "Zwrot",
      category: "Laptop",
      productName: "Lenovo ThinkPad X1",
      purchaseDate: recentPurchaseDate(5),
      imagePath: "e2e/fixtures/clean-product.jpg",
    });
    console.log(`[restore][AC-27] initial decision category: ${decisionCategory}`);

    await sendChatTurn(page, "Czy mogę dołączyć paragon później?");
    await sendChatTurn(page, "Czy mam zapakować produkt w oryginalne pudełko?");

    const beforeReload = await canonicalTranscript(page);
    expect(beforeReload.map((entry) => entry.role)).toEqual([
      "assistant",
      "user",
      "assistant",
      "user",
      "assistant",
    ]);
    expect(beforeReload[0]?.text).toContain("To jest wstępna ocena");

    await page.reload();
    await expect(page.getByTestId("decision-block")).toBeVisible({
      timeout: 30_000,
    });

    const afterReload = await canonicalTranscript(page);
    expect(afterReload).toEqual(beforeReload);
    console.log(
      `[restore][AC-27] restored transcript messages: ${afterReload.length}`,
    );
  });

  test("unknown session id shows a Polish not-found page", async ({ page }) => {
    await page.goto("/chat/unknown-session-id");

    await expect(
      page.getByRole("heading", { name: "Nie znaleziono zgłoszenia" }),
    ).toBeVisible();
    await expect(
      page.getByText("Zgłoszenie o podanym numerze nie istnieje lub zostało usunięte."),
    ).toBeVisible();
    console.log("[restore][not-found] Polish not-found page observed");
  });
});
