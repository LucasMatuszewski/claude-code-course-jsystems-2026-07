import { expect, type Locator, type Page } from "@playwright/test";

export const DISCLAIMER_PL =
  "To jest wstępna ocena — ostateczną decyzję potwierdzi nasz pracownik.";

const VALID_DECISION_BADGES = [
  "Zaakceptowano",
  "Odrzucono",
  "Wymagane informacje",
  "Eskalacja",
] as const;

type RequestType = "Reklamacja" | "Zwrot";
export type DecisionBadge = (typeof VALID_DECISION_BADGES)[number];
export type DecisionCategoryKey =
  | "APPROVE"
  | "REJECT"
  | "MORE_INFO"
  | "ESCALATE";

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

export function purchaseDateDaysAgo(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
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
  const day = page.locator(`[data-day="${plDataDay(date)}"]`).first();

  for (let i = 0; i < 24; i += 1) {
    if ((await day.count()) > 0 && (await day.isVisible())) {
      await day.click();
      return;
    }

    const direction = await calendarNavigationDirection(page, date);
    await calendarNavButton(page, direction).click();
  }

  throw new Error(`Could not find purchase date ${plDataDay(date)} in calendar`);
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

export function decisionBadgeToKey(label: string): DecisionCategoryKey {
  switch (label) {
    case "Zaakceptowano":
      return "APPROVE";
    case "Odrzucono":
      return "REJECT";
    case "Wymagane informacje":
      return "MORE_INFO";
    case "Eskalacja":
      return "ESCALATE";
    default:
      throw new Error(`Unknown decision badge: ${label}`);
  }
}

export async function submitRequestAndWaitForDecision(
  page: Page,
  options: FillRequestFormOptions,
): Promise<DecisionCategoryKey> {
  await page.goto("/");
  await fillRequestForm(page, options);
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
  await page.waitForURL(/\/chat\/.+/, { timeout: 90_000 });
  await assertChatSessionMatchesUrl(page);
  return decisionBadgeToKey(await assertDecisionStructure(page));
}

export async function sendChatTurn(page: Page, text: string): Promise<void> {
  const assistantMessages = page.locator('[data-role="assistant"]');
  const initialAssistantCount = await assistantMessages.count();
  const chatInput = page.getByLabel("Napisz wiadomość…");
  const sendButton = page.getByRole("button", { name: "Wyślij" });
  const typingIndicator = page.getByLabel("Asystent pisze…");

  await chatInput.fill(text);
  await sendButton.click();
  await expect(typingIndicator).toBeVisible({ timeout: 10_000 });
  await expect(sendButton).toBeDisabled();
  await expect(typingIndicator).toBeHidden({ timeout: 90_000 });
  await expect.poll(
    async () => assistantMessages.count(),
    { timeout: 90_000 },
  ).toBeGreaterThan(initialAssistantCount);
  await expect(chatInput).toBeEnabled();
}

export async function canonicalTranscript(page: Page): Promise<
  Array<{ role: string; text: string }>
> {
  return page.locator("[data-role]").evaluateAll((nodes) =>
    nodes.map((node) => {
      const clone = node.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("time").forEach((time) => time.remove());
      return {
        role: node.getAttribute("data-role") ?? "",
        text: (clone.textContent ?? "").replace(/\s+/g, " ").trim(),
      };
    }),
  );
}

export async function assertNoHorizontalScroll(page: Page): Promise<void> {
  const hasHorizontalScroll = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalScroll).toBe(false);
}

async function calendarNavigationDirection(
  page: Page,
  targetDate: Date,
): Promise<"previous" | "next"> {
  const visibleDays = await page.locator("[data-day]").evaluateAll((nodes) =>
    nodes
      .map((node) => node.getAttribute("data-day"))
      .filter((value): value is string => value !== null),
  );
  const visibleDates = visibleDays.map(parsePlDataDay).filter(isValidDate);
  if (visibleDates.length === 0) {
    return "previous";
  }

  const minVisibleTime = Math.min(...visibleDates.map((day) => day.getTime()));
  return targetDate.getTime() < minVisibleTime ? "previous" : "next";
}

function calendarNavButton(
  page: Page,
  direction: "previous" | "next",
): Locator {
  const calendar = page.locator('[data-slot="calendar"]');
  return direction === "previous"
    ? calendar.locator("button").first()
    : calendar.locator("button").nth(1);
}

function parsePlDataDay(value: string): Date {
  const [day, month, year] = value.split(".").map(Number);
  return new Date(year, month - 1, day);
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}
