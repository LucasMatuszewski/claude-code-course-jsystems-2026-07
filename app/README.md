# Hardware Service Decision Copilot — app

A multimodal AI assistant proof-of-concept for a consumer-electronics retailer's return and complaint process. A customer submits a return ("Zwrot") or complaint ("Reklamacja") request with a photo of the product; the backend runs a two-stage AI pipeline (multimodal image analysis, then a policy-grounded decision agent) over OpenRouter models, and the customer continues in a streaming chat where the agent can request a better photo, answer follow-ups, and revise its decision. Cases the AI cannot decide are escalated to a read-only reviewer list. See `docs/PRD.md` §1–§2 for the full product framing.

This is the Next.js (App Router, TypeScript strict) project root for the PoC. Companion documents live at the repository root:

- `docs/PRD.md` — product requirements and acceptance criteria (AC-01..AC-51)
- `docs/ADR/` — architecture decision records (`000-main-architecture.md` plus 001–004 for scaffolding, AI, persistence, frontend)
- `docs/design-guidelines.md` — design system / Play brand tokens

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the repo-root `.env.example` to `.env` inside `app/` and fill in real values:
   ```bash
   cp ../.env.example .env
   ```
   Required variables:
   - `OPENROUTER_API_KEY` — OpenRouter API key
   - `OPENROUTER_BASE_URL` — OpenRouter API base URL
   - `OPENROUTER_TEXT_MODEL` — text model used for the decision agent and chat
   - `OPENROUTER_VISION_MODEL` — vision model used for multimodal image analysis

   Optional:
   - `OPENROUTER_MODEL` — fallback model used only when a split model variable above is missing, and only outside `NODE_ENV=production`
   - `PORT` — dev server port (defaults to 3000)

   `src/lib/config.ts` fails fast at startup with a descriptive error naming any missing required variable.

## Running

```bash
npm run dev     # start the dev server (http://localhost:3000)
npm run build   # production build
npm start       # run the production build (after npm run build)
```

Note: `npm run build` and `npm run dev`/`npm start` share the same `.next` output directory. Don't run a stale `.next` from a build against a dev server session started before it (or vice versa) — if API routes start returning inexplicable 404s, clear `.next` and restart.

## Testing

```bash
npm test           # Vitest unit + integration tests
npx playwright test  # E2E tests (equivalent to `npm run test:e2e`)
npm run lint        # ESLint
```

Notes on `npx playwright test`:
- Requires a working `OPENROUTER_API_KEY` — several specs call the real OpenRouter LLM (no mocking in E2E, per the repo's test strategy).
- Run `npx playwright install chromium` once before the first run.
- The Playwright config starts its own dev server (`webServer`); don't run it against a directory where `npm run build` just produced a `.next` that a dev server hasn't refreshed (see the note above).

Test strategy (see `docs/ADR/000-main-architecture.md` §10 for the full rationale): unit tests mock all dependencies, integration tests mock only the OpenRouter/AI SDK model call, E2E tests mock nothing.

## Route map

Pages:
- `/` — request form (start screen)
- `/chat/[caseId]` — chat / decision screen
- `/reviewer` — reviewer list (escalated cases, newest first)
- `/reviewer/[caseId]` — reviewer case detail (read-only)

API routes:
- `POST /api/cases` — create a case from the form + image, runs the two-stage AI pipeline, returns the first decision
- `GET /api/cases/[caseId]` — full case state (form data, images, analyses, decision history, chat transcript)
- `POST /api/cases/[caseId]/chat` — streaming chat turn; may re-run image analysis on a re-uploaded photo and issue/revise a decision via the `submitDecision` tool
- `GET /api/images/[...path]` — serves a stored case image (protected against path traversal)
- `GET /api/reviewer/cases` — list of escalated cases (`needs_review = true`)

## Project structure

```
src/
  app/            Pages and API routes (see route map above)
  components/
    request-form/ Form fields, client-side validation, image upload widget
    chat/          Chat shell, decision block, message parts, re-upload prompt input
    reviewer/      Escalated cases table, case detail view, transcript view
    ai-elements/   Generated AI Elements components (streaming chat primitives)
    ui/            Generated shadcn/ui components
  lib/
    config.ts      Fail-fast env var loading
    copy/pl.ts      Single source of all Polish user-facing strings
    validation/     Shared client/server Zod schema for the request form
    db/             SQLite (better-sqlite3) schema + typed repositories
    images/         sharp-based compression + on-disk storage
    policies/       Loads the return/complaint policy markdown from `docs/policies/`
    ai/             Prompts, schemas, OpenRouter providers, the two-stage pipeline and streaming chat
```

For deeper context on any of the above, see the relevant ADR (001 scaffolding, 002 AI, 003 persistence, 004 frontend) rather than this file — it stays intentionally brief.
