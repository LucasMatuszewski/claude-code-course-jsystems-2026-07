# Repository Guidelines

## Project

This is a **course project** for the "Claude Code – od zera do zespołu agentów AI" training by JSystems — an **open course** (participants from multiple companies), 2026-07-13..15, 3 days, remote. The app is a multimodal AI assistant built live during the course. The domain, tech stack, and architecture are decided by the group through a structured process: research → PRD → ADR → implementation with agents.

This is only the **base starting repository** for the course; concrete decisions are made live with the group.

**Primary demo stack:** TypeScript/Node.js (Next.js, Vercel AI SDK).
**Java is a first-class participant stack** (Spring Boot, Spring AI, LangChain4j or OpenAI Java SDK — see `course-materials/agent-configs/`); each participant picks their stack during the ADR phase.
Participants may work in any language (Java, Python, C#, Go, Rust, etc.).

All user-facing text in **Polish**.

## Course Delivery Environment (Windows Server 2022 VMs)

Participants work on prepared VMs with preinstalled tools:
- **Agents:** Claude Desktop + Claude Code CLI, Codex (desktop + CLI), OpenCode (desktop + CLI), Antigravity
- **Editors:** `micro` (default `$EDITOR` in git bash, PowerShell and git), Fresh (terminal), Lite XL (default GUI editor for code files). IntelliJ is installed (Java file association) but **slow on VMs — avoid for live work**
- **Runtimes:** Node.js, Bun, Python, .NET runtime (no SDK — not used in this course)
- **LLM access for built apps:** `OPENROUTER_API_KEY` preset in Windows env vars (multimodal models available via OpenRouter)
- Participants clone this repository at course start; the app is built on a **separate branch** per participant/group — `main` stays course-materials-only.

**Key docs** (created during the course — load only when in doubt):
- `docs/PRD.md` — product requirements and acceptance criteria
- `docs/ADR/` — Architecture Decision Records
- `docs/design-guidelines.md` — design system and tokens

---

## Repository Layout

`course-materials/slides/publish-slides.ps1` syncs the slide decks to the DevPowers site repo — run it after EVERY deck change; `-Push` deploys to production.

---

## Agent Workflow

### Before Starting Any Task
1. Read the relevant PRD and ADR files for the affected area.
2. Define the expected behavior from the specification before writing or changing any code.

### TDD Rules
For every feature and bug fix:
1. Start from the specification, not the existing implementation.
2. Write or extend tests **before** production code.
3. Run the new tests and confirm they fail for the expected reason.
4. Implement the minimum code needed to make them pass.
5. Run the full verification suite for the changed scope.
6. Refactor only while tests stay green.
7. **Manually validate the running application** (see Manual QA below). Automated tests — especially E2E — can produce false passes; a task is not done until the real app has been exercised by hand.

If the area has no suitable test infrastructure yet, add it as part of the task — do not silently skip tests.

### Manual QA (required after every task that affects the running app)

Use **Playwright MCP or the Playwright CLI** to drive the real running app like a human tester:

1. Start the app (`npm run dev`) and open it in the browser.
2. Exercise the flow affected by your change end to end — e.g. fill the form with real values, upload a real image, submit, wait for the actual AI response, continue in the chat. Do not stop at "the page rendered".
3. Take a **screenshot at every screen/state** of the exercised flow and inspect it: correct layout, Polish texts, loading/error states, no broken elements.
4. Check the browser console for errors — zero errors expected.
5. **Compare the screenshots against the Play brand reference** (`assets/homepage.png` + `docs/design-guidelines.md`): colors (purple `#6C43BF`, magenta `#E6144B`), Manrope typography, 7px-scale radii/spacing. Flag any visual drift.
6. Report what was manually verified (flows, screenshots taken, findings) as part of task completion. If manual QA fails, the task is NOT done — fix before committing.

### Verification (required before every commit)

Run the commands appropriate for the chosen stack. Typically for a TypeScript project:
```bash
npm test             # unit/integration tests pass
npm run lint         # ESLint — no errors
npm run build        # build succeeds
```

Verify only the scope relevant to your change. If the change affects runtime behavior, confirm the app starts correctly.

**Test Strategy:**
| Type | Mocks | Who |
|---|---|---|
| Unit | All deps | be/fe-dev |
| Integration | Only external LLM API | be-dev |
| E2E | NOTHING (real stack) | qa-engineer |

**Verification:** Always start the app before committing. Tests passing ≠ app working.

**Env Vars:** See `.env.example` (OPENROUTER_API_KEY or OPENAI_API_KEY required)

### Commit Rules
- Commit only after verification passes and the changed scope is in a working state.
- Keep commits focused: one logical change per commit.
- Format: `Area: short summary` (e.g. `Backend:`, `Frontend:`, `Docs:`)
- Do **not** push to remote unless the user explicitly asks.

### Completion Criteria
A task is complete only when:
- Implementation matches the relevant PRD, ADR, and design guidance
- Tests were written first and pass honestly
- Verification for the changed scope passed with no errors or warnings
- The commit message is focused and the repository is in a consistent, reviewable state

---

## Context7 MCP Library IDs

Common libraries (resolve via `resolve-library-id` if the ID changes):

| Library | Context7 ID |
|---|---|
| Vercel AI SDK | `/vercel/ai` |
| Next.js | `/vercel/next.js` |
| React | `/reactjs/react.dev` |
| Tailwind CSS | `/tailwindlabs/tailwindcss.com` |
| Shadcn/ui | `/shadcn-ui/ui` |
| Mastra | `/mastra-ai/mastra` |
