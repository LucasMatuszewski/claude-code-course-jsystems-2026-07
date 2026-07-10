# Program szkolenia

## Claude Code – od zera do zespołu agentów AI

> **Szkolenie otwarte JSystems** | 13–15.07.2026 | 3 dni | zdalnie
>
> **Prowadzący demonstruje:** TypeScript + Vercel AI SDK. **Uczestnicy mogą pracować we własnym stacku** (Java, Python, C#, Go, Rust itp.).
>
> **Projekt kursowy:** multimodalna aplikacja AI Chat (obsługa zwrotów i reklamacji) zbudowana z agentami Claude Code.

---

## Dzień 1: Fundamenty i start projektu

*Temat przewodni: Środowisko, tryby pracy i konfiguracja agenta*

### Moduł 1.1: Wprowadzenie i konfiguracja

- Poznajmy się – doświadczenia uczestników
- AI w programowaniu 2026: agenci, a nie tylko asystenci
- Trendy i case studies
- Korzyści vs ryzyka (halucynacje, context rot, koszty)
- Weryfikacja środowiska: CLI, Desktop, IDE, Node.js, Git
- Pierwsze uruchomienie Claude Code

**Cel:** Gotowe i sprawdzone środowisko pracy

---

### Moduł 1.2: Tryby pracy i kluczowe funkcje

- CLI interaktywny vs `-p` (headless)
- Desktop App (chat z kodem, Hyper-V sandbox)
- Claude Web (remote environments)
- Kiedy który tryb wybrać
- Kluczowe komendy: `/resume`, `/compact`, `/context`, `/model`, `/permissions`
- Modele Opus/Sonnet/Haiku oraz alternatywy (np. GLM-5) – kiedy który <!-- TODO-VERIFY: aktualne nazwy i dostępność modeli -->
- Zarządzanie kontekstem: okno, kompresja, context rot
- Uprawnienia i tryby bezpieczeństwa (allowedTools, denyTools, Sandbox)

**Cel:** Swobodna praca w każdym trybie Claude Code

---

### Moduł 1.3: Context Engineering i konfiguracja agenta

- Od prompt engineering do context engineering
- `CLAUDE.md` i `AGENTS.md` (projekt + globalny)
- Struktura kontekstu: system prompt, konfiguracja, pamięć
- Path-based rules vs zagnieżdżone `CLAUDE.md`
- Praktyka: `CLAUDE.md`/`AGENTS.md` dla naszego projektu
- Best practices (max ~200 linii, jak iterować)

**Cel:** Skonfigurowany agent „znający" nasz projekt

---

### Moduł 1.4: Projekt – AI Chat z Vercel AI SDK

- Omówienie projektu: AI Chat (backend + frontend) do obsługi zwrotów/reklamacji
- Tworzenie PRD (wymagania produktowe)
- Architektura: TypeScript + Vercel AI SDK + streaming
- ADR (Architecture Decision Record)
- Agent inicjalizuje template Vercel AI

**Cel:** Plan aplikacji AI Chat i uruchomiony scaffolding

---

**Praca domowa D1:** Dokończenie scaffoldingu; rozbudowa `CLAUDE.md`; eksperymenty z trybami pracy.

---

## Dzień 2: Narzędzia, sub-agenci i budowa funkcjonalności

*Temat przewodni: Wyposażenie agenta w narzędzia i zespół*

### Moduł 2.1: MCP

- MCP (Model Context Protocol) – czym jest i dlaczego coraz częściej Skills zamiast MCP
- Konfiguracja: `.mcp.json`, settings
- Context7 (aktualna dokumentacja bibliotek)
- Playwright MCP (przeglądarka, testy E2E)
- Inne serwery MCP
- **Praktyka:** Design Guidelines wygenerowane z dowolnej strony przez Playwright MCP

**Cel:** Agent z dostępem do dokumentacji i przeglądarki

---

### Moduł 2.2: Skills

- Skills – umiejętności agenta wielokrotnego użytku
- Instalowanie istniejących skills jako template
- Tworzenie własnych skills z historii sesji i workflow
- Skrypty/narzędzia w skills
- Custom slash commands

**Cel:** Skonfigurowane narzędzia i workflows dostosowane do projektu

---

### Moduł 2.3: Sub-agenci

- Architektura sub-agentów (Task tool, typy agentów)
- Orkiestracja: główny agent kontroluje specjalistów
- Typy: Explore, Plan, custom (be-dev, fe-dev, qa)
- Konfiguracja, pamięć, zasady zespołowe
- **Praktyka:** definiowanie specjalistów:
  - `be-developer` (TypeScript backend)
  - `fe-developer` (React / Vercel AI SDK)
  - `qa-engineer`
- Delegowanie pierwszych zadań; monitorowanie i feedback

**Cel:** Działający zespół sub-agentów

---

### Moduł 2.4: Budowa aplikacji z sub-agentami (TDD)

- TDD z agentem: Red-Green-Refactor (testy PRZED kodem)
- API backend (streaming, Vercel AI SDK)
- React `useChat`, streaming, komponenty
- Integracja frontend-backend
- Podział ról: be-developer buduje endpoint, fe-developer UI, qa robi review + E2E
- Git: granularne commity po każdej zielonej fazie

**Cel:** Wstępny działający kod aplikacji od wielu agentów

---

**Praca domowa D2:** Dokończenie aplikacji; rozbudowa (historia czatów, rendering markdown); eksperymenty z delegowaniem; optymalizacja `CLAUDE.md`/`AGENTS.md`.

---

## Dzień 3: Zespoły agentów, jakość i produkcja

*Temat przewodni: Praca równoległa, jakość i wdrożenie*

### Moduł 3.1: Agent Teams – praca równoległa

- Od sub-agentów do zespołów
- Git worktrees (równoległe gałęzie pracy)
- Task Plan Matrix: zależności, fazy, briefing
- **Praktyka:** 3 agentów równolegle (BE feature, FE feature, testy E2E – każdy w worktree); merge i rozwiązywanie konfliktów

> **Dodatkowo (zatwierdzone):** Workflows – skrypty JS orkiestrujące subagentów + goal command (20–30 min).

**Cel:** Dokończenie aplikacji równolegle, merge wyników

---

### Moduł 3.2: Testowanie i jakość

- Self-assessment i feedback loop TDD
- `qa-engineer`: testy E2E (skill) + manualne (MCP)
- Playwright MCP w testach
- Code review z agentem (security, jakość)
- Ograniczenia AI i konieczność human review

**Cel:** Kompleksowe testy i review aplikacji

---

### Moduł 3.3: Claude w chmurze i CI/CD

- Claude Web remote environments (secrets, starting script, integracja z GitHub)
- Headless `-p` w GitHub Actions
- Koszty i optymalizacja (tokeny, modele, cache) <!-- TODO-VERIFY: aktualne ceny i limity -->
- *Adaptacja ankieta:* większość uczestników korzysta z Jenkins – pokazany wariant Jenkins

**Cel:** Agent w chmurze oraz w pipeline CI/CD

---

### Moduł 3.4: Podsumowanie

- Demo projektów uczestników
- Retrospektywa
- Best practices zespołowe
- Tematy zaawansowane, modele lokalne (np. Gemma) <!-- TODO-VERIFY: aktualne nazwy modeli lokalnych -->
- Zasoby do dalszej nauki

**Cel:** Samodzielność po kursie
