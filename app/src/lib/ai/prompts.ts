import type { RequestFormInput } from "@/lib/validation";
import type { DecisionCategory, ImageAnalysis } from "./types";

/**
 * Pure prompt + instruction builders for the AI stages (ADR-001 section 3
 * "prompts": "No I/O — unit-testable as string builders").
 *
 * Every function here:
 *   - is a pure string builder (no network, no disk, no `Date.now()`);
 *   - embeds the customer's form values verbatim so the model can ground
 *     its justification in them (AC-13);
 *   - carries a Polish-output directive (PRD section 11 "Language and tone"
 *     — "Polish only, including when the customer writes in another
 *     language");
 *   - is request-type specific (damage causes for complaints, resellability
 *     for returns) per AC-09.
 *
 * The deterministic hard-rule guard (`guard.ts`) is what *enforces* the
 * "never"/"disclaimer" rules; the prompts only *instruct* the model toward
 * them (ADR-001 D1-05 "layered behavior control").
 */

// --- The mandatory Polish disclaimer (PRD section 11 "Mandatory disclaimer") -
//
// Exact wording taken from PRD section 11. Lives here (not in
// `lib/i18n/pl.ts`) per ADR-001 section 4 / ADR-002 section 3: this string
// is part of the *AI-generated decision message*, not static UI chrome, so
// the i18n module explicitly excludes it. The guard appends it server-side
// to every decision message regardless of model output (AC-16, TAC-001-03).
export const DISCLAIMER_PL =
  "To jest wstępna ocena — ostateczną decyzję potwierdzi nasz pracownik.";

// --- Shared Polish-output directive -----------------------------------------

const POLISH_OUTPUT_DIRECTIVE =
  "Odpowiedź przygotuj ZAWSZE w języku polskim, również gdy klient pisze w innym języku. " +
  'Zwracaj się do klienta per «Państwo» / «Pan/Pani». Ton: uprzejmy, ciepły, prosty — bez żargonu prawnego bez wyjaśnienia, bez języka marketingowego.';

// --- Shared form-embedding helper -------------------------------------------

/**
 * Renders the form values the customer submitted as a stable, labelled
 * block that the model can quote back in its justification (AC-13
 * "references at least one concrete input"). Used by all four stage
 * prompts. Polish labels per PRD section 9.1.
 */
function renderFormBlock(form: RequestFormInput): string {
  const lines: string[] = [
    `Typ zgłoszenia: ${form.requestType === "complaint" ? "Reklamacja" : "Zwrot"}`,
    `Kategoria sprzętu: ${form.category}`,
    `Nazwa/model produktu: ${form.productName}`,
    `Data zakupu: ${form.purchaseDate}`,
  ];
  if (form.reason !== undefined && form.reason.trim().length > 0) {
    lines.push(`Powód/opis od klienta: ${form.reason}`);
  }
  lines.push(`Załączony obraz: typ MIME ${form.image.type}, rozmiar ${form.image.size} B`);
  return lines.join("\n");
}

/**
 * Renders an ImageAnalysis as a labelled block for the decision stage (and
 * for the chat system prompt). Only includes non-null fields so the model
 * isn't asked to reason about "null" placeholders.
 */
function renderAnalysisBlock(analysis: ImageAnalysis): string {
  const lines: string[] = [
    `imageUsable: ${analysis.imageUsable}`,
    `matchesDeclaredProduct: ${analysis.matchesDeclaredProduct}`,
    `damageVisible: ${analysis.damageVisible}`,
    `confidence: ${analysis.confidence}`,
  ];
  if (analysis.unusableReason !== null) lines.push(`unusableReason: ${analysis.unusableReason}`);
  if (analysis.damageDescription !== null) lines.push(`damageDescription: ${analysis.damageDescription}`);
  if (analysis.plausibleCauses !== null) lines.push(`plausibleCauses: ${analysis.plausibleCauses}`);
  if (analysis.usageSigns !== null) lines.push(`usageSigns: ${analysis.usageSigns}`);
  if (analysis.resellableAssessment !== null) lines.push(`resellableAssessment: ${analysis.resellableAssessment}`);
  return lines.join("\n");
}

// --- Stage 1: vision instructions -------------------------------------------

/**
 * Instruction for the vision model on a COMPLAINT (PRD section 11 "Vision
 * analysis — Complaint": is the equipment damaged, what kind of damage,
 * plausible causes — manufacturing defect vs. mechanical/user-caused;
 * matches declared category/model; is the image usable). The model only
 * *describes*; it does not decide anything.
 */
export function buildComplaintVisionPrompt(form: RequestFormInput): string {
  return [
    "Jesteś analitykiem wizyjnym w serwisie sprzętu elektronicznego (tryb: REKLAMACJA).",
    "Opisujesz zdjęcie zgłoszone przez klienta — NIE podejmujesz decyzji reklamacyjnej.",
    "",
    "Oceń zdjęcie pod kątem:",
    "1. Czy obraz jest wystarczająco ostry i pokazuje sprzęt (imageUsable). Jeśli nie — wskaż powód (rozmycie / niewłaściwy obiekt / sprzęt niewidoczny / niezgodność z kategorią).",
    "2. Czy przedmiot zgadza się z zadeklarowaną kategorią i modelem (matchesDeclaredProduct).",
    "3. Czy sprzęt jest uszkodzony (damageVisible) oraz rodzaj i lokalizacja uszkodzenia (damageDescription).",
    "4. Prawdopodobne przyczyny uszkodzenia (plausibleCauses): oceń, czy to wada fabryczna, czy uszkodzenie mechaniczne spowodowane przez użytkownika.",
    "5. Poziom pewności swojej oceny (confidence: high | medium | low).",
    "",
    "Dane zgłoszenia od klienta:",
    renderFormBlock(form),
    "",
    POLISH_OUTPUT_DIRECTIVE,
  ].join("\n");
}

/**
 * Instruction for the vision model on a RETURN (PRD section 11 "Vision
 * analysis — Return": does the equipment show damage or signs of usage;
 * does it appear complete and resellable; matches declared category/model;
 * is the image usable). The model only *describes*; it does not decide
 * anything.
 */
export function buildReturnVisionPrompt(form: RequestFormInput): string {
  return [
    "Jesteś analitykiem wizyjnym w serwisie sprzętu elektronicznego (tryb: ZWROT).",
    "Opisujesz zdjęcie zgłoszone przez klienta — NIE podejmujesz decyzji o zwrocie.",
    "",
    "Oceń zdjęcie pod kątem:",
    "1. Czy obraz jest wystarczająco ostry i pokazuje sprzęt (imageUsable). Jeśli nie — wskaż powód (rozmycie / niewłaściwy obiekt / sprzęt niewidoczny / niezgodność z kategorią).",
    "2. Czy przedmiot zgadza się z zadeklarowaną kategorią i modelem (matchesDeclaredProduct).",
    "3. Czy sprzęt jest uszkodzony (damageVisible) oraz rodzaj i lokalizacja uszkodzenia (damageDescription).",
    "4. Widoczne ślady użytkowania (usageSigns): rysy, otarcia, ślady po montażu, brak folii ochronnej itp.",
    "5. Czy produkt wydaje się kompletny i nadający się do odsprzedaży jako nowy (resellableAssessment).",
    "6. Poziom pewności swojej oceny (confidence: high | medium | low).",
    "",
    "Dane zgłoszenia od klienta:",
    renderFormBlock(form),
    "",
    POLISH_OUTPUT_DIRECTIVE,
  ].join("\n");
}

// --- Stage 2: decision instructions -----------------------------------------

/**
 * Instruction for the decision agent on a COMPLAINT. Embeds the complaint
 * policy prose verbatim, the form values, and the vision-analysis findings
 * (including plausible causes — complaint-specific). Produces a
 * structured DecisionResult with Polish messageMarkdown.
 *
 * The model is told about the four categories and the rule that an
 * APPROVE/REJECT is impossible when `imageUsable=false` — but the
 * deterministic guard in `guard.ts` is what actually guarantees it.
 */
export function buildComplaintDecisionPrompt(
  form: RequestFormInput,
  analysis: ImageAnalysis,
  policyProse: string,
): string {
  return [
    "Jesteś agentem decyzyjnym serwisu sprzętu elektronicznego (tryb: REKLAMACJA).",
    "Podejmujesz wstępną decyzję na podstawie danych formularza, analizy zdjęcia i dokumentu polityki reklamacji.",
    "",
    "Kategorie decyzji (zwróć dokładnie jedną):",
    "- APPROVE — zgłoszenie spełnia warunki polityki (uzasadnienie + kolejne kroki dla klienta).",
    "- REJECT — zgłoszenie narusza regułę polityki (cytuj konkretny identyfikator reguły).",
    "- MORE_INFO — brakuje informacji potrzebnych do decyzji (wskaż dokładnie czego).",
    "- ESCALATE — wymaga opinii człowieka (np. zdjęcie nieważne, sprawa niejednoznaczna, klient kwestionuje decyzję).",
    "",
    "Bezwzględne zasady:",
    "- Nie aprovuj (APPROVE) ani nie odrzucaj (REJECT), gdy imageUsable=false — wtedy ESCALATE.",
    "- Uzasadnienie musi odwoływać się do konkretnego wejścia (znalezisko zdjęcia, wartość formularza, identyfikator reguły).",
    "- REJECT musi cytować identyfikator reguły polityki (np. C-1, C-6).",
    "- Każda wiadomość kończy się klauzulą: «" + DISCLAIMER_PL + "»",
    "",
    "Dokument polityki reklamacji (źródło prawdecyzji — nie wymyślaj reguł nieobecnych w dokumencie):",
    "---",
    policyProse,
    "---",
    "",
    "Wynik analizy zdjęcia:",
    renderAnalysisBlock(analysis),
    "",
    "Dane zgłoszenia od klienta:",
    renderFormBlock(form),
    "",
    POLISH_OUTPUT_DIRECTIVE,
  ].join("\n");
}

/**
 * Instruction for the decision agent on a RETURN. Embeds the return policy
 * prose verbatim, the form values, and the vision-analysis findings
 * (including usage signs and resellability — return-specific). Produces a
 * structured DecisionResult with Polish messageMarkdown.
 */
export function buildReturnDecisionPrompt(
  form: RequestFormInput,
  analysis: ImageAnalysis,
  policyProse: string,
): string {
  return [
    "Jesteś agentem decyzyjnym serwisu sprzętu elektronicznego (tryb: ZWROT).",
    "Podejmujesz wstępną decyzję na podstawie danych formularza, analizy zdjęcia i dokumentu polityki zwrotów.",
    "",
    "Kategorie decyzji (zwróć dokładnie jedną):",
    "- APPROVE — zwrot zgodny z polityką (okno zwrotu, brak śladów użytkowania, nadaje się do odsprzedaży jako nowy).",
    "- REJECT — naruszenie reguły polityki (np. przekroczone okno zwrotu, widoczne ślady użytkowania); cytuj identyfikator reguły.",
    "- MORE_INFO — brakuje informacji (wskaż dokładnie czego).",
    "- ESCALATE — wymaga opinii człowieka (zdjęcie nieważne, sprawa niejednoznaczna, klient kwestionuje decyzję).",
    "",
    "Bezwzględne zasady:",
    "- Nie approvuj (APPROVE) ani nie odrzucaj (REJECT), gdy imageUsable=false — wtedy ESCALATE.",
    "- Uzasadnienie musi odwoływać się do konkretnego wejścia (znalezisko zdjęcia, wartość formularza, identyfikator reguły).",
    "- REJECT musi cytować identyfikator reguły polityki (np. R-1, R-4).",
    "- Każda wiadomość kończy się klauzulą: «" + DISCLAIMER_PL + "»",
    "",
    "Dokument polityki zwrotów (źródło decyzji — nie wymyślaj reguł nieobecnych w dokumencie):",
    "---",
    policyProse,
    "---",
    "",
    "Wynik analizy zdjęcia:",
    renderAnalysisBlock(analysis),
    "",
    "Dane zgłoszenia od klienta:",
    renderFormBlock(form),
    "",
    POLISH_OUTPUT_DIRECTIVE,
  ].join("\n");
}

// --- Chat system prompt ------------------------------------------------------

/**
 * Server-side context assembled per chat turn (ADR-001 section 4
 * "ChatSessionContext"). The chat system prompt embeds all of it so the
 * agent never asks the customer to repeat information (AC-19) and so the
 * `revise_decision` tool receives the same hard-rule context as the
 * initial decision guard.
 */
export interface ChatSessionSummary {
  form: RequestFormInput;
  analysis: ImageAnalysis;
  /** Ordered (oldest first) list of decisions recorded for this session so far. */
  decisionHistory: ReadonlyArray<{
    category: DecisionCategory;
    justification: string;
    /** ISO timestamp the decision was recorded. */
    timestamp: string;
  }>;
  /** Prose of the matching policy document (frontmatter values are consumed by the guard, not the prompt). */
  policyProse: string;
  /** Visible to the customer (AC-25) and cited in ESCALATE messages (AC-26). */
  sessionId: string;
}

/**
 * System prompt for the streaming chat agent (ADR-001 section 3 "chat").
 * Instructs the agent on tone, off-topic refusal, the four-category
 * decision contract, and the hard rule that a revision must never
 * contradict policy (AC-22). The deterministic `revise_decision` tool —
 * which calls `applyGuard` before persisting — is what actually enforces
 * the last point; this prompt only aligns the model's visible text.
 */
export function buildChatSystemPrompt(session: ChatSessionSummary): string {
  const historyBlock =
    session.decisionHistory.length === 0
      ? "(brak wcześniejszych decyzji — to pierwsza odpowiedź w czacie)"
      : session.decisionHistory
          .map(
            (d, i) =>
              `${i + 1}. ${d.category} @ ${d.timestamp} — uzasadnienie: ${d.justification}`,
          )
          .join("\n");

  return [
    "Jesteś agentem asystującym w serwisie sprzętu elektronicznego — pomagasz klientowi po wysłaniu zgłoszenia (reklamacja lub zwrot).",
    "Rozmowa toczy się w kontekście jednego zgłoszenia; klient nie powinien musieć powtarzać informacji (AC-19).",
    "",
    "Zasady zachowania (PRD section 11):",
    "- Odpowiadaj ZAWSZE po polsku, również gdy klient pisze w innym języku.",
    '- Zwracaj się per «Państwo» / «Pan/Pani»; ton uprzejmy, ciepły, prosty.',
    "- Pytania POZA TEMATEM tego zgłoszenia (inne produkty, ogólne wsparcie techniczne, small talk poza powitaniem) krótko, grzecznie odmów i naprowadź klienta z powrotem na sprawę. Nigdy nie odpowiadaj na tematy niezwiązane ze zgłoszeniem.",
    "- Nie podawaj porade prawnej ani nie interpretuj przepisów poza treścią dokumentu polityki.",
    "- Nie wymyślaj reguł polityki, nie obiecuj zwrotów kosztów, napraw ani odszkodowań, których nie ma w dokumencie.",
    "- Nie proś o dane osobowe poza tymi z formularza.",
    "- Nie twierdź, że jesteś człowiekiem.",
    "- Każda decyzja (pierwsza i zrewidowana) musi kończyć się klauzulą: «" + DISCLAIMER_PL + "»",
    "- Jeśli w czacie zmieniasz ocenę, wyraźnie wskaż: poprzednia decyzja, nowa decyzja i powód zmiany (AC-21). Użyj narzędzia revise_decision.",
    "- BEZWZGLĘDNIE: nigdy nie zmieniaj decyzji na APPROVE, gdy naruszałoby to twardą regułę polityki (np. przekroczone okno zwrotu). W takim przypadku decyzja to ESCALATE (AC-22).",
    "",
    "Identyfikator sesji ( widoczny dla klienta): " + session.sessionId,
    "",
    "Dokument polityki dla tego zgłoszenia:",
    "---",
    session.policyProse,
    "---",
    "",
    "Wynik analizy zdjęcia:",
    renderAnalysisBlock(session.analysis),
    "",
    "Dane zgłoszenia od klienta:",
    renderFormBlock(session.form),
    "",
    "Historia decyzji w tej sesji (od najstarszej):",
    historyBlock,
  ].join("\n");
}
