import { expect, test } from "@playwright/test";

import {
  assertDecisionStructure,
  decisionBadgeToKey,
  submitRequestAndWaitForDecision,
} from "./helpers";

test.describe("E2E edge cases: unusable image and retry", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only real-LLM spec");
  });

  test("AC-10 escalates an unusable image with Polish photo-not-assessable wording", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const decisionCategory = await submitRequestAndWaitForDecision(page, {
      requestType: "Zwrot",
      category: "Laptop",
      productName: "Lenovo ThinkPad X1",
      purchaseDate: new Date(),
      imagePath: "e2e/fixtures/unusable-blurry.jpg",
    });

    expect(decisionCategory).toBe("ESCALATE");

    const decisionText =
      (await page.getByTestId("decision-block").textContent()) ?? "";
    expect(decisionText).toMatch(
      /nie (?:mogliśmy|moglismy|da się|da sie).*oceni|zdjęci[ae].*(?:nieczytelne|niewyraźne|niewyrazne|rozmazane)|nie można ocenić zdjęcia|nie mozna ocenic zdjecia/i,
    );

    const badge = await assertDecisionStructure(page);
    console.log(
      `[failure-retry][AC-10] decision category: ${decisionBadgeToKey(badge)}`,
    );
    console.log(
      `[failure-retry][AC-10] photo-not-assessable wording observed: ${/oceni|zdjęci|zdjec/i.test(decisionText)}`,
    );
  });

  test.skip(
    "AC-28 analyze-failure retry is covered by T3.2 integration tests",
    async () => {
      test.info().annotations.push({
        type: "reason",
        description:
          "The running Playwright webServer is configured once from the real repo-root .env. Temporarily invalidating OPENROUTER_API_KEY for only one E2E request would require a separate server process or mutating shared runtime configuration, so the clean coverage for AC-28 remains the T3.2 integration suite.",
      });
    },
  );
});
