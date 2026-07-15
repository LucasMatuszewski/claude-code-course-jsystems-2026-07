/**
 * Stage 1 (vision model) prompt builders (ADR-002 §3, PRD §11 "Image
 * analyzer" role). One builder per request type — the two roles ask
 * different questions of the same photo, so they are not parameterized
 * into a single function the way the decision system prompt is.
 */

import type { CaseFormValues } from "@/lib/validation/case-form.schema";

/**
 * Complaint (reklamacja): assess whether the product is damaged, the
 * damage type, and its plausible cause — manufacturing defect vs.
 * external/user-inflicted (PRD §4.2, §11). Includes the form's description
 * field (the customer's own account of the defect) as context for the
 * vision model. Must not crash if `description` is missing, even though
 * form validation blocks that in practice (ADR-002 §8 test scenario).
 */
export function imageAnalysisComplaintPrompt(formData: CaseFormValues): string {
  const description = formData.description?.trim() || "(brak opisu)";

  return `Jesteś analitykiem zdjęć w systemie obsługi reklamacji sprzętu elektronicznego.
Otrzymujesz zdjęcie produktu zgłoszonego jako reklamacja.

Dane zgłoszenia:
- Kategoria: ${formData.category}
- Produkt: ${formData.productName}
- Opis usterki podany przez klienta: ${description}

Twoje zadanie:
1. Oceń, czy produkt jest uszkodzony i jaki jest rodzaj uszkodzenia.
2. Oceń prawdopodobną przyczynę uszkodzenia — czy to wygląda na wadę fabryczną
   (defekt produkcyjny), czy raczej na uszkodzenie zewnętrzne/spowodowane przez
   użytkownika (np. upadek, zalanie, celowe uszkodzenie).
3. Jeśli zdjęcie jest zbyt niewyraźne, produkt nie jest w pełni widoczny lub nie
   da się ocenić uszkodzenia, oznacz analizę jako niejednoznaczną i opisz, co
   dokładnie uniemożliwia ocenę (to zostanie pokazane klientowi).

Zwróć ustrukturyzowaną analizę zgodną z podanym schematem.`;
}

/**
 * Return (zwrot): assess absence of damage and signs of use, i.e. whether
 * the product is still resellable (PRD §4.1, §11).
 */
export function imageAnalysisReturnPrompt(formData: CaseFormValues): string {
  return `Jesteś analitykiem zdjęć w systemie obsługi zwrotów sprzętu elektronicznego.
Otrzymujesz zdjęcie produktu zgłoszonego do zwrotu.

Dane zgłoszenia:
- Kategoria: ${formData.category}
- Produkt: ${formData.productName}

Twoje zadanie:
1. Oceń, czy produkt nosi widoczne ślady użytkowania (zarysowania, zabrudzenia,
   ślady zużycia) lub uszkodzenia.
2. Oceń możliwość odsprzedaży produktu jako "jak nowy" na podstawie stanu
   widocznego na zdjęciu.
3. Jeśli zdjęcie jest zbyt niewyraźne, produkt nie jest w pełni widoczny lub nie
   da się ocenić stanu, oznacz analizę jako niejednoznaczną i opisz, co
   dokładnie uniemożliwia ocenę (to zostanie pokazane klientowi).

Zwróć ustrukturyzowaną analizę zgodną z podanym schematem.`;
}
