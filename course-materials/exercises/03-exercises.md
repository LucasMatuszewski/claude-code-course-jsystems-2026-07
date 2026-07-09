# 03-exercises.md — Mapa ćwiczeń (zsynchronizowana ze skryptami Day 1–5)

Ten plik jest mapą operacyjną. **Źródło prawdy dla prowadzenia zajęć to skrypty dzienne**:
- `course-materials/day-scripts/day-1.md`
- `course-materials/day-scripts/day-2.md`
- `course-materials/day-scripts/day-3.md`
- `course-materials/day-scripts/day-4.md`
- `course-materials/day-scripts/day-5.md`

Case kursowy: **SOC Copilot Incident Triage**.

## Zasady wykonania
- Najpierw Track Core, potem Stretch.
- Każde ćwiczenie ma zakończyć się artefaktem możliwym do pokazania na demo.
- W module security używamy klasyfikacji `CRITICAL/HIGH/MEDIUM/LOW`.

---

## Day 1 — Fundamenty i bezpieczny start

### D1-E1 — Safe setup + workflow start
**Starter:** `exercises/day-1/d1-e1-safe-setup-starter.md`

**Core:**
- Konfiguracja środowiska i zasad pracy z agentem (branch, approvals, sandbox).
- Pierwszy mały task z pełnym review diffu.

**Stretch:**
- Dodanie checklisty review i wariantu cloud-max / on-prem.

**Expected output:**
- Zasady pracy (8–15 punktów) + 1 mały artefakt wykonany w pętli diff/test/review.

### D1-E2 — Quiz kalibracyjny + adaptacja
**Starter:** `exercises/day-1/d1-e2-quiz-adaptation-starter.md`

**Core:**
- Uruchomienie quizu i zebranie obszarów wymagających doprecyzowania.

**Stretch:**
- Mapa decyzji trenerskich na Day 2–Day 3.

**Expected output:**
- Krótki summary + 3–5 decyzji adaptacyjnych.

---

## Day 2 — Od problemu do planu implementacji

### D2-E1 — Problem framing + acceptance criteria
**Starter:** `exercises/day-2/d2-e1-problem-framing-starter.md`

**Core:**
- Problem statement, persona, wartość, granice MVP i kryteria akceptacji.

**Stretch:**
- Ryzyka regulacyjne + kryteria jakości/safety.

**Expected output:**
- Jednostronicowy brief + assumptions/constraints + out-of-scope.

### D2-E2 — Architektura + model danych + ADR
**Starter:** `exercises/day-2/d2-e2-architecture-adr-starter.md`

**Core:**
- Szkic architektury, model danych i 1 ADR.

**Stretch:**
- Wariant cloud-max vs on-prem + wskazanie audit trail.

**Expected output:**
- Mapa komponentów + model danych + ADR z kompromisami.

### D2-E3 — Task slicing pod agenta
**Starter:** `exercises/day-2/d2-e3-task-slicing-starter.md`

**Core:**
- Backlog małych, testowalnych slice’ów z Definition of Done.

**Stretch:**
- Priorytetyzacja i failure modes.

**Expected output:**
- Backlog 8–15 zadań gotowy na implementację Day 3.

---

## Day 3 — Implementacja rdzenia

### D3-E1 — Backend/API + guardrails
**Core:**
- 1–2 kluczowe flow backendowe + walidacje i bezpieczne logowanie.

**Stretch:**
- Dodatkowy endpoint lub wariant ścieżki + mini-audit trail.

**Expected output:**
- Działający pion request -> logika -> dane -> odpowiedź.

### D3-E2 — Integracja UI/CLI z backendem
**Core:**
- End-to-end dla jednego scenariusza użytkownika.

**Stretch:**
- Obserwowalność + obsługa sytuacji awaryjnej model/API.

**Expected output:**
- Demo flow + lista edge case’ów do domknięcia w Day 4.

---

## Day 4 — Jakość i bezpieczeństwo

### D4-E1 — Testy i review pętli AI
**Core:**
- Zielony zestaw testów krytycznego flow + review zmian.

**Stretch:**
- Test integracyjny/kontraktowy + checklista pre-merge.

**Expected output:**
- Raport review + lista poprawek jakościowych.

### D4-E2 — Security audit (legacy JFTP) — checkpoint obowiązkowy
**Core:**
- Analiza fragmentu legacy JFTP i lista ryzyk.

**Checkpoint obowiązkowy:**
- Każde ryzyko oznaczone jako `CRITICAL/HIGH/MEDIUM/LOW`.
- Dla `CRITICAL/HIGH`: `fix now` + `fix next sprint`.
- Decyzja końcowa: `fix now / mitigate / accept (z uzasadnieniem)`.

**Stretch:**
- Quick wins 24h vs hardening 2–4 tygodnie.

**Expected output:**
- Tabela decyzji auditowych + plan remediacji.

### D4-E3 — CI/CD cloud vs on-prem
**Core:**
- Minimalny pipeline cloud i odpowiednik on-prem.

**Stretch:**
- Approvals, audit trail, fallback bez modelu/cloud.

**Expected output:**
- Tabela porównawcza + krótki playbook wdrożeniowy.

---

## Day 5 — Domknięcie i plan wdrożenia

### D5-E1 — Final demo + decyzje techniczne
**Core:**
- Pokaz spójnego MVP i obrona kluczowych wyborów.

**Stretch:**
- Dodatkowa analiza kompromisów architektonicznych.

**Expected output:**
- Demo + lista decyzji z uzasadnieniem.

### D5-E2 — Final security audit — checkpoint obowiązkowy
**Core:**
- Audyt finalnej aplikacji i klasyfikacja ryzyk.

**Checkpoint obowiązkowy:**
- Decyzja `GO / GO WITH CONDITIONS / NO-GO` z uzasadnieniem.

**Stretch:**
- Plan hardeningu po szkoleniu.

**Expected output:**
- Końcowa decyzja wdrożeniowa + lista działań po kursie.

### D5-E3 — 30-day adoption plan
**Core:**
- Plan tygodniowy wdrożenia AI workflow.

**Stretch:**
- KPI + model raportowania postępu.

**Expected output:**
- Gotowy plan 30 dni dla zespołu uczestnika.

---

## Synchronizacja
- Prompty: `prompts/02-module-prompts.md`
- Chat-pastes: `materials/trainer-chat-pastes.md`
- Jeżeli treść rozjeżdża się ze skryptem dziennym, popraw ten plik tak, by odzwierciedlał Day script 1:1.
