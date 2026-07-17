import { expect, test } from "@playwright/test";

import {
  fillRequestForm,
  pickPurchaseDate,
  recentPurchaseDate,
  selectOption,
} from "./helpers";

test.use({ browserName: "chromium" });

test.describe("Request form validation", () => {
  test("blocks an empty submit and focuses the first invalid field", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();

    await expect(
      page.getByText("Wybierz rodzaj zgłoszenia (Reklamacja lub Zwrot)."),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Rodzaj zgłoszenia" }),
    ).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
  });

  test("blocks a complaint without the required reason", async ({ page }) => {
    await page.goto("/");

    await fillRequestForm(page, {
      requestType: "Reklamacja",
      category: "Laptop",
      productName: "Lenovo ThinkPad X1",
      purchaseDate: recentPurchaseDate(10),
      imagePath: "e2e/fixtures/clean-product.jpg",
    });

    await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();

    await expect(
      page.getByText("Opis usterki jest wymagany dla reklamacji."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("blocks submit when the image is missing", async ({ page }) => {
    await page.goto("/");

    await selectOption(page, "Rodzaj zgłoszenia", "Zwrot");
    await selectOption(page, "Kategoria sprzętu", "Laptop");
    await page.getByLabel("Nazwa / model produktu").fill("Lenovo ThinkPad X1");
    await pickPurchaseDate(page, recentPurchaseDate(5));
    await page
      .getByLabel("Powód zgłoszenia (opcjonalnie)")
      .fill("Produkt nie spełnia moich oczekiwań.");

    await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();

    await expect(page.getByText("Dodaj zdjęcie sprzętu.")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});
