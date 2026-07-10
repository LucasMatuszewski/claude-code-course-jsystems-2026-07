# Claude Code – od zera do zespołu agentów AI
### Szkolenie otwarte JSystems, 13–15.07.2026 (3 dni, zdalnie)

---

**Prowadzący:** [Łukasz Matuszewski](https://devpowers.com/) | [JSystems](https://jsystems.pl)

**Opis szkolenia:** [Claude Code – od zera do zespołu agentów AI](https://jsystems.pl/szkolenia-ai;claude_code.szczegoly)

> **Kurs otwarty:** uczestnicy z różnych firm, praca na przygotowanych maszynach wirtualnych (Windows Server 2022) z preinstalowanymi narzędziami. Sklonuj to repozytorium na początku kursu.
>
> To jest jedynie **bazowe repozytorium startowe** kursu. Domena, tech stack i architektura zostaną ustalone live z grupą.

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
- 📜 Skrypty z poszczególnych dni (`course-materials/03-2026/day-*-full-script.md`)
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
examples/            Przykładowe konfiguracje agentów (Java/Spring Boot)
```

---

## Technologie

Kurs jest stack-agnostic. Technologie zostaną wybrane live z grupą podczas ADR. Możliwe opcje:

- **Java**: Spring Boot, Spring AI lub LangChain4j / OpenAI Java SDK (zobacz `examples/agent-configs/`)
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
