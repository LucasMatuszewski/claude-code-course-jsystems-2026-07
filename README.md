> # 🔔 AKTUALIZACJA PO KURSIE — przykładowa implementacja aplikacji
>
> Oryginalny README zaczyna się poniżej, w sekcji [„Claude Code – od zera do zespołu agentów AI”](#claude-code--od-zera-do-zespołu-agentów-ai).
>
> Przykładowa, w pełni działająca implementacja projektu kursowego (**Hardware Service Decision Copilot** — asystent zwrotów i reklamacji sprzętu elektronicznego) została zbudowana na osobnym branchu:
>
> ### 👉 Branch z aplikacją: [`course-application-implementation`](https://github.com/LucasMatuszewski/claude-code-course-jsystems-2026-07/tree/course-application-implementation)
>
> Cała aplikacja powstała przez **orkiestrację agentów AI** według procesu z kursu (research → PRD → ADR → plan implementacji z macierzą zależności → realizacja falami/„wave” w izolowanych zakresach plików → serializowane merge → weryfikacja + TDD + E2E na prawdziwym LLM). Pełny plan i przebieg (historia realizacji w planie): [`docs/implementation-plan.md`](https://github.com/LucasMatuszewski/claude-code-course-jsystems-2026-07/blob/course-application-implementation/docs/implementation-plan.md).
>
> ## Jak to zostało zrobione — dwa podejścia w jednym projekcie
>
> Scafold aplikacji (baza) została zrobiona przez Fable delegującego do sub-agentów Opus/Fable, jednak zużywali oni szybko limit 5h.
> **Fale 2 i 3 (Wave 2 + Wave 3)** — większość tych zadań wykonał model **GLM-5.2** (kontunuował sesję w ClaudeCode - sprawdź [przykładowy plik `.bashrc`](https://github.com/LucasMatuszewski/claude-code-course-jsystems-2026-07/blob/main/course-materials/.bashrc) nadpisujący ustawienia ClaudeCode dowolnym providerem compatybilnym z Anthropic Messages API).
> Uwaga praktyczna: GLM-5.2 **znacznie szybciej wpada w limit 5h** niż jeszcze kilka miesięcy temu — na dokończenie zadań z tych dwóch fal potrzebowałem **dwóch okien limitu 5h** na planie Lite, ale zużyłem w tym czasie aż 122,545,047 tokenów, znacznie więcej niż pozwoli Claude Code (a w promocji subskrypcję Z.ai Coding Plan Lite kupiłem za $35 za ROK).
>
> **Reszta prac (pozostałe fale + gate końcowy)** — przełączyłem się na **Opus (orkiestracja) + delegacja do agentów CLI** (patrz [przykładowy prompt delegacji do agentów CLI](https://github.com/LucasMatuszewski/claude-code-course-jsystems-2026-07/blob/main/course-materials/Prompt%20examples/Deletage-to-Codex-Agy-OpenCode-Grok.md)) i cała pozostała część aplikacji została ukończona w **jednym oknie limitu 5h**:
> - **Opus** — orkiestracja: architektura, plan, decyzje o merge, przegląd i osąd końcowy;
> - **Codex** (`codex exec`) — implementacja kodu i uruchamianie weryfikacji;
> - **agy** (Antigravity/Gemini) — analiza wizualna (screenshoty, zgodność z brandem Play).
>
> ⚠️ **Ważna lekcja o delegacji:** orkiestrator **nie powinien tworzyć własnych sub-agentów Claude** tylko po to, żeby te przekazywały zadanie do agenta CLI — to marnuje kontekst/tokeny (każdy taki „kurier” to osobny, drogi kontekst Claude). Do agentów CLI (Codex/agy/grok) **deleguj bezpośrednio** (przez Bash), a sam orkiestrator pisze brief, przegląda wynik, weryfikuje i commituje. Sub-agenta Claude twórz tylko wtedy, gdy to model Claude ma wykonać właściwą pracę.
>
> ## Podejrzyj zmiany w PR
>
> Zmiany można przejrzeć w otwartym **Pull Requeście** (opis + diff + historia commitów): **[lista PR-ów tego repozytorium](https://github.com/LucasMatuszewski/claude-code-course-jsystems-2026-07/pulls)**.
>
> ---
>
> <!-- ⬇⬇⬇ ORYGINALNY README KURSU ZACZYNA SIĘ TUTAJ ⬇⬇⬇ -->

# Claude Code – od zera do zespołu agentów AI
### Szkolenie otwarte JSystems, 13–15.07.2026 (3 dni, zdalnie)

---

**Prowadzący:** [Łukasz Matuszewski](https://devpowers.com/) | [JSystems](https://jsystems.pl)

**Opis szkolenia:** [Claude Code – od zera do zespołu agentów AI](https://jsystems.pl/szkolenia-ai;claude_code.szczegoly)

> **Kurs otwarty:** uczestnicy z różnych firm, praca na przygotowanych maszynach wirtualnych (Windows Server 2022) z preinstalowanymi narzędziami. Zrób fork tego repozytorium i sklonuj go na początku kursu (instrukcja poniżej).
>
> To jest jedynie **bazowe repozytorium startowe** kursu. Domena, tech stack i architektura zostaną ustalone live z grupą.

---

## Start: fork → clone → branch → upstream

Materiały będą aktualizowane w trakcie i po kursie (nowe przykłady, historia czatu z Zoom, podsumowania nagrań). Dlatego **zrób fork zamiast zwykłego clone** — będziesz mógł pobierać aktualizacje, zachowując własną pracę.

> **Zasada repo:** `main` = wyłącznie materiały kursowe (aktualizowane przez trenera). Aplikację budujemy **zawsze na osobnym branchu** — dzięki temu `main` w Twoim forku zostaje czysty i aktualizacje od trenera wchodzą bez konfliktów.

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
4. **Od razu utwórz branch roboczy** — na nim budujesz aplikację i robisz notatki:
   ```bash
   git checkout -b moja-praca
   ```
5. **Pobieranie aktualizacji od trenera** (w trakcie i po kursie):
   ```bash
   git checkout main
   git pull upstream main
   git checkout moja-praca
   ```
   Jeśli chcesz mieć nowe materiały także na branchu roboczym: `git merge main`.

## Praca na VM czy lokalnie?

Każdy uczestnik dostaje **VM z Windows Server 2022** (IP + login + hasło od trenera na starcie) z preinstalowanymi wszystkimi narzędziami — tam wszystko działa dokładnie tak, jak na pokazach trenera.

- **Zalecane: pracuj na VM** — identyczne środowisko, zero niespodzianek, trener może pomóc od ręki.
- **Możesz pracować lokalnie** (sklonuj fork także u siebie), ale **na własne ryzyko**: lokalne środowisko może się różnić, a debugowanie różnic robimy tylko, jeśli starczy czasu (najlepiej po kursie).

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
