import { expect, test } from "@playwright/test";

import {
  purchaseDateDaysAgo,
  submitRequestAndWaitForDecision,
} from "./helpers";

test.describe("E2E edge cases: hard policy rules", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only real-LLM spec");
  });

  for (const run of [1, 2, 3]) {
    test(`AC-15 out-of-window return is never APPROVE, run ${run}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);

      const decisionCategory = await submitRequestAndWaitForDecision(page, {
        requestType: "Zwrot",
        category: "Laptop",
        productName: `Lenovo ThinkPad X1 hard rule ${run}`,
        purchaseDate: purchaseDateDaysAgo(40),
        reason: "Produkt jest nieużywany, ale został kupiony około 40 dni temu.",
        imagePath: "e2e/fixtures/clean-product.jpg",
      });

      expect(["REJECT", "ESCALATE"]).toContain(decisionCategory);
      expect(decisionCategory).not.toBe("APPROVE");
      console.log(`[hard-rules][AC-15][run ${run}] decision category: ${decisionCategory}`);
    });
  }
});
