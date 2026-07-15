# Repository Guidelines

## Project

This is a **course project** for the "Claude Code – od zera do zespołu agentów AI" training by JSystems — an **open course** (participants from multiple companies), 2026-07-13-15, 3 days, remote. The app is a multimodal AI assistant built live during the course. The domain, tech stack, and architecture are decided by the group through a structured process: research → PRD → ADR → implementation with agents.

This is only the **base starting repository** for the course; concrete decisions are made live with the group.

**Primary demo stack:** TypeScript/Node.js (Next.js, Vercel AI SDK).

All user-facing text in **Polish** on chat. Repo docummentation always in English.

**Key docs** (created during the course — load only when in doubt):
- `docs/PRD.md` — product requirements and acceptance criteria
- `docs/ADR/` — Architecture Decision Records
- `docs/design-guidelines.md` — design system and tokens

---

## Repository Layout

```
app/                 Application built during the course (start: empty scaffold)
assets/              Design tokens, logo, favicon
docs/                PRD, ADR, design system
course-materials/    Notes, scripts, examples, research
course-materials/slides/   Slide decks day-1.html..day-3.html (single-file HTML)
                           + publish-slides.ps1 (sync to the DevPowers site repo;
                           run after EVERY deck change, `-Push` = deploy to production)
```

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
2. Take a screenshot of every screen you touched.
3. Exercise the real flow end-to-end by hand: fill the form, upload the image, submit, follow the navigation to the chat, send a message — whatever the changed scope covers.
4. Verify the flow actually works: correct navigation, correct data displayed, no console errors, Polish UI text.
5. **Compare your screenshots against the Play brand reference** (`assets/homepage.png` + `docs/design-guidelines.md` tokens): colors, typography (Manrope), spacing, button styles, logo placement must match the Play look.
6. Report what you validated (steps + screenshots) in your task summary. If anything looks or behaves wrong, fix it before committing.

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

**Verification:** Always start the app before committing. Tests passing ≠ app working. Automated E2E results are not sufficient proof — always finish with the Manual QA step above.

**Env Vars:** See `.env.example` (OPENROUTER_API_KEY required)

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
- Manual QA was performed on the running app (Playwright MCP/CLI, screenshots, flow exercised, Play-brand visual check)
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
