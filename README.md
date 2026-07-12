# Claude Code – od zera do zespołu agentów AI
### Szkolenie otwarte JSystems, 13–15.07.2026 (3 dni, zdalnie)

---

**Prowadzący:** [Łukasz Matuszewski](https://devpowers.com/) | [JSystems](https://jsystems.pl)

**Opis szkolenia:** [Claude Code – od zera do zespołu agentów AI](https://jsystems.pl/szkolenia-ai;claude_code.szczegoly)

> **Kurs otwarty:** uczestnicy z różnych firm, praca na przygotowanych maszynach wirtualnych (Windows Server 2022) z preinstalowanymi narzędziami. Zrób fork tego repozytorium i sklonuj go na początku kursu (instrukcja poniżej).
>
> To jest jedynie **bazowe repozytorium startowe** kursu. Domena, tech stack i architektura zostaną ustalone live z grupą.

---

## Start: fork → clone → upstream

Materiały będą aktualizowane w trakcie i po kursie (nowe przykłady, historia czatu z Zoom, podsumowania nagrań). Dlatego **zrób fork zamiast zwykłego clone** — będziesz mógł pobierać aktualizacje, zachowując własną pracę.

1. **Fork:** kliknij `Fork` na stronie tego repozytorium (potrzebujesz konta GitHub).
2. **Clone forka na VM:**
   ```bash
   git clone https://github.com/TWOJ-LOGIN/claude-code-course-jsystems-2026-07.git
   cd claude-code-course-jsystems-2026-07
   ```
3. **Dodaj upstream (repozytorium trenera):**
   ```bash
   git remote add upstream https://github.com/LucasMatuszewski/claude-code-course-jsystems-2026-07.git
   ```
4. **Pobieranie aktualizacji od trenera** (w trakcie i po kursie):
   ```bash
   git fetch upstream
   git merge upstream/main
   ```
5. **Własna praca na osobnym branchu** (`main` zostaje na materiały kursowe):
   ```bash
   git checkout -b moja-praca
   ```

## Dostęp do Claude Code (pierwszy dzień kursu)

- **Zalecane:** własne konto Claude (Pro/Max/Team) — logowanie `claude` → przeglądarka, lub własny `ANTHROPIC_API_KEY`.
- **Nie masz konta?** Zgłoś się do trenera na starcie kursu — przygotowane są opcje zapasowe.
- Ustawiony na VM `OPENROUTER_API_KEY` służy **aplikacji, którą budujemy** (dostęp do modeli multimodalnych przez OpenRouter) — nie jest to klucz logowania do Claude Code.

## Slajdy i prompty online

Prezentacje z kursu i biblioteka promptów z przyciskami kopiowania: **[devpowers.com/szkolenia/claude-code-jsystems](https://devpowers.com/szkolenia/claude-code-jsystems/)**

---

## O repozytorium

To repozytorium zawiera materiały do 3-dniowego kursu **Claude Code** prowadzonego przez JSystems (szkolenie otwarte). Kurs skupia się na workflow pracy z agentami AI (Claude Code, OpenAI Codex CLI), a nie na jednym konkretnym narzędziu.

Uczestnicy pracują w swoim preferowanym języku programowania (Java, Python, C#, Go, Rust i inne). Prowadzący demonstruje rozwiązania w **TypeScript/Node.js** (np. z **Vercel AI SDK**), natomiast **głównym językiem backendu może być Java** — ostateczny wybór zostanie podjęty wspólnie z grupą podczas etapu ADR.

### Projekt kursu

Multimodalna aplikacja AI — na przykład agent weryfikujący usterki, zwroty i reklamacje sprzętu elektronicznego. Konkretny projekt i tech stack ustalane są live z grupą po przez proces: research → PRD → ADR → implementacja z agentami.

---

## Materiały kursu

Główne notatki i zasoby znajdziesz w folderze `/course-materials`:

- 📓 [**Course Notes — AI in Programming**](course-materials/Course%20Notes%20-%20AI%20in%20Programming.md) — główne notatki: trendy, narzędzia, benchmarki, metodologie agentic coding, best practices.
- 📅 [**Agenda kursu**](course-materials/course-agenda.md) — program 3-dniowego szkolenia.
- 📜 Skrypty z poszczególnych dni (`course-materials/day-scripts/`) — archiwum 5-dniowej wersji kursu; obowiązuje `course-agenda.md`
- 🔬 Materiały badawcze (`course-materials/Research/`)
- 💡 Przykłady promptów (`course-materials/Prompt examples/`)
- 🎓 Technika Ralph Wiggum Bash Loop (`course-materials/how-to-ralph-wiggum/`)

---

## Struktura repozytorium

```
app/                 Aplikacja budowana podczas kursu (start: pusty scaffold)
assets/              Design tokens, logo, favicon (dodawane w trakcie kursu)
docs/                PRD, ADR, design system (tworzone podczas kursu)
course-materials/    Notatki, skrypty, przykłady, badania

```

---

## Technologie

Kurs jest stack-agnostic. Technologie zostaną wybrane live z grupą podczas ADR. Możliwe opcje:

- **Java**: Spring Boot, Spring AI lub LangChain4j / OpenAI Java SDK (zobacz `course-materials/agent-configs/`)
- **TypeScript/Node.js** (demo prowadzącego): Next.js, Vercel AI SDK, Mastra
- Inne stacki wg preferencji uczestników

---

## Narzędzia AI

Główny agent używany na kursu: **Claude Code** lub **OpenAI Codex CLI** (wybór zależy od preferencji grupy). Omawiane koncepcje są transferowalne na Gemini CLI, OpenCode, Cursor, Zed, Junie, Copilot i inne.

---

## Konfiguracja środowiska

Szczegóły w [`.env.example`](.env.example).

Wymagane:
- Klucz API (OpenAI, OpenRouter, lub inny provider)
- Agent CLI (Claude Code lub Codex)
- Git

---

## Kontakt

- **JSystems:** [jsystems.pl](https://jsystems.pl)
- **Prowadzący:** [Łukasz Matuszewski](https://devpowers.com/)
