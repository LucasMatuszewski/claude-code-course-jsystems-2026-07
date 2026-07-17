import { expect, type Page } from "@playwright/test";

export const DISCLAIMER_PL =
  "To jest wstępna ocena — ostateczną decyzję potwierdzi nasz pracownik.";

const VALID_DECISION_BADGES = [
  "Zaakceptowano",
  "Odrzucono",
  "Wymagane informacje",
  "Eskalacja",
] as const;

type RequestType = "Reklamacja" | "Zwrot";

type FillRequestFormOptions = {
  requestType: RequestType;
  category: string;
  productName: string;
  purchaseDate: Date;
  reason?: string;
  imagePath?: string;
};

export function recentPurchaseDate(daysAgo: number): Date {
  const today = new Date();
  const candidate = new Date(today);
  candidate.setDate(candidate.getDate() - daysAgo);

  if (candidate.getMonth() !== today.getMonth()) {
    return today;
  }

  return candidate;
}

export function plDataDay(date: Date): string {
  const day = date.getDate();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

export async function selectOption(
  page: Page,
  label: string,
  option: string,
): Promise<void> {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).click();
}

export async function pickPurchaseDate(
  page: Page,
  date: Date,
): Promise<void> {
  await page.getByRole("button", { name: "Data zakupu" }).click();
  await page.locator(`[data-day="${plDataDay(date)}"]`).click();
}

export async function fillRequestForm(
  page: Page,
  options: FillRequestFormOptions,
): Promise<void> {
  await selectOption(page, "Rodzaj zgłoszenia", options.requestType);
  await selectOption(page, "Kategoria sprzętu", options.category);
  await page.getByLabel("Nazwa / model produktu").fill(options.productName);
  await pickPurchaseDate(page, options.purchaseDate);

  if (options.reason) {
    const reasonLabel =
      options.requestType === "Reklamacja"
        ? "Powód zgłoszenia (wymagane)"
        : "Powód zgłoszenia (opcjonalnie)";
    await page.getByLabel(reasonLabel).fill(options.reason);
  }

  if (options.imagePath) {
    await page.getByLabel("Zdjęcie sprzętu").setInputFiles(options.imagePath);
  }
}

export async function assertChatSessionMatchesUrl(page: Page): Promise<void> {
  const sessionId = new URL(page.url()).pathname.split("/").filter(Boolean).pop();

  expect(sessionId).toBeTruthy();
  await expect(page.getByTestId("chat-session-id")).toBeVisible();
  await expect(page.getByTestId("chat-session-id")).toHaveText(sessionId!);
}

export async function assertDecisionStructure(page: Page): Promise<string> {
  const decisionBlock = page.getByTestId("decision-block");
  await expect(decisionBlock).toBeVisible({ timeout: 60_000 });

  const badgeText = (await page.getByTestId("decision-badge").textContent())?.trim();
  expect(VALID_DECISION_BADGES).toContain(
    badgeText as (typeof VALID_DECISION_BADGES)[number],
  );

  await expect(page.getByTestId("decision-disclaimer")).toHaveText(
    DISCLAIMER_PL,
  );

  const blockText = (await decisionBlock.textContent()) ?? "";
  expect(blockText.trim().length).toBeGreaterThan(40);

  return badgeText ?? "";
}

export async function assertNoHorizontalScroll(page: Page): Promise<void> {
  const hasHorizontalScroll = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalScroll).toBe(false);
}
