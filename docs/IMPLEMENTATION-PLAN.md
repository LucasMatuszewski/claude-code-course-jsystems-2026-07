# Implementation Plan — Hardware Service Decision Copilot PoC

**Date:** 2026-07-15
**Status:** Awaiting approval (no implementation starts before explicit "go")
**Sources:** `docs/PRD.md`, `docs/ADR/000..004`, `docs/design-guidelines.md`, `assets/design-tokens.json`
**Branch:** `moja-praca` · **Project root:** `app/` · **Package manager:** npm

---

## 1. Ground Rules (apply to EVERY task)

### Orchestration model
- The orchestrator (main session) **never implements**. It delegates each task below to exactly one specialized agent (`be-developer`, `fe-developer`, `qa-engineer`) with the Context Package defined for that task, audits the result and the commit, and only then unlocks dependent tasks.
- At most **2 agents run in parallel**, and only when the plan marks the tasks as parallel-safe (disjoint file sets). All other tasks run sequentially.
- If an agent reports a blocker or wants to change a file it does not own, it must stop and report back — the orchestrator re-scopes rather than letting the agent improvise.

### TDD loop (mandatory per task)
1. Read the task's Context Package references.
2. Write the tests listed in the task **first**; run them; confirm they fail for the expected reason.
3. Implement the minimum code to pass.
4. Run scoped verification: `npm test` + `npm run lint` + `npm run build` (all from `app/`); Phase 4 adds `npx playwright test`.
5. **Manual QA (mandatory for every task that affects the running app, from P0.4 onward):** per the root `AGENTS.md` "Manual QA" section — start `npm run dev`, drive the real app with Playwright MCP/CLI like a human tester (fill the form with real values, upload a real image, submit, wait for the real response, continue the flow), screenshot every screen/state, check the browser console for errors, and compare the visuals against the Play brand reference (`assets/homepage.png` + `docs/design-guidelines.md`). Automated tests — especially E2E — can produce false passes; a task is not done until the real app has been exercised by hand. Include what was manually verified in the task report.
6. Commit (see below). Never commit with failing verification or failed manual QA.

### Orchestrator manual QA at every gate (in addition to per-task agent QA)
At **every phase gate** (GATE 0–3, end of P4, end of P5) the orchestrator itself — not an agent — opens the running application with Playwright MCP, walks the currently-implemented flows by hand (form fill → submit → chat → reviewer, as far as implemented), takes screenshots of each screen, verifies zero console errors, and visually compares the screens with `assets/homepage.png` and the design tokens. A gate does not open on green test suites alone; the orchestrator must have seen the app working with its own screenshots. Findings that contradict a "passing" report send the task back to its agent as a defect.

### Commit rules
- Each task ends in **one focused commit** by the agent that did the work (multiple commits allowed if the task lists sub-steps).
- Format: `Area: short summary` where Area ∈ `Setup | Backend | Frontend | Tests | Docs`.
- Commit **only files owned by the task** (explicit `git add <paths>`, never `git add -A`). Never push.

### File-ownership & conflict prevention
- `package.json` / lockfile: modified **only** in Phase 0 tasks. Later tasks must not add dependencies; if one seems needed, report to orchestrator.
- `src/lib/copy/pl.ts`: authored **completely** in task P1.1 (all Polish strings for the whole app, extracted from PRD §6/§9/§11). All later tasks import from it read-only. If a string is genuinely missing, the agent adds it in a **separate commit touching only `pl.ts`**, and such tasks are never scheduled in parallel with another `pl.ts`-consumer task.
- Design theme (`globals.css`, Tailwind theme, fonts, logo/favicon): owned by P0.4; later frontend tasks consume classes/variables, never edit the theme.
- During Phase 4 (E2E), **no other agent runs** — the app under test must not change mid-run, and only one dev server owns port 3000.

### Environment facts (include in every agent brief)
- Windows Server 2022 VM; shells: PowerShell + Git Bash; repo at `C:\Users\labuser\dev\claude-code-course-jsystems-2026-07`; Next.js project root is the `app/` subfolder — all npm commands run from `app/`.
- `OPENROUTER_API_KEY` is preset as a user-level env var. `.env` in `app/` is created in P0.1 from repo-root `.env.example` (vars: `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_TEXT_MODEL`, `OPENROUTER_VISION_MODEL`, `OPENROUTER_MODEL`, `PORT`). Never print or commit key values.
- Library docs: use the ctx7 CLI (`npx ctx7@latest docs <handle> "<question>"`). The MCP context7 server has an invalid API key on this VM — use the CLI. Handles: `/vercel/next.js`, `/vercel/ai`, `/openrouterteam/ai-sdk-provider`, `/vercel/ai-elements`, `/lovell/sharp`, `/wiselibs/better-sqlite3`.
- All user-facing text in **Polish**; all code, comments, tests, commits in **English**.

---

## 2. Phase Overview

| Phase | Goal | Agent(s) | Blocking gate to next phase |
|---|---|---|---|
| P0 | Working scaffold: Next.js + test infra + theme | be-developer, fe-developer | `npm run build/lint/test` green on empty scaffold (TAC-001-02) |
| P1 | Core libraries: copy, validation, db, images, policies, ai | be-developer ×2 (parallel windows) | All lib unit tests green |
| P2 | API routes (LLM mocked in tests) | be-developer | All integration tests green |
| P3 | Frontend pages | fe-developer (+be finishing P2.3 in parallel) | Component tests green, pages render |
| P4 | E2E with real LLM + fix rounds | qa-engineer (exclusive) | Full suite incl. Playwright green |
| P5 | Docs polish + final audit | be-developer | Repo consistent, all TACs checked |

---

## 3. Tasks

Legend per task: **Agent** · **Depends on** · **Parallel-safe with** · **Owned files** · **TDD tests (write first)** · **Context Package** (exactly what goes into the agent prompt) · **Commit**.

---

### Phase 0 — Scaffold & Infrastructure (sequential except P0.4)

#### P0.1 — Scaffold Next.js project in `app/`
- **Agent:** be-developer · **Depends on:** — · **Parallel-safe with:** none
- **Owned files:** everything `create-next-app` generates in `app/`, `app/.env` (gitignored), `.gitignore` additions
- **Steps:** run `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm` from inside `app/` (check `--help` first if a flag errors; the folder contains only README.md which current CLI versions accept); verify `tsconfig.json` has `"strict": true`; create `app/.env` from repo-root `.env.example` (do not commit); ensure `.gitignore` covers `.env`, `data/`, `uploads/`; run build+lint.
- **TDD tests:** none (scaffold); verification = TAC-001-01/02 (`strict: true`; build+lint exit 0).
- **Context Package:** ADR-001 §4 steps 1–2 & 6 verbatim; environment facts (§1 above); commit rules; explicit instruction NOT to install extra deps yet (P0.2/P0.3 do that).
- **Commit:** `Setup: scaffold Next.js App Router project with TypeScript strict`

#### P0.2 — Test infrastructure (Vitest + Playwright)
- **Agent:** be-developer · **Depends on:** P0.1 · **Parallel-safe with:** none (touches package.json)
- **Owned files:** `vitest.config.ts`, `playwright.config.ts`, `tests/unit/`, `tests/integration/`, `tests/e2e/` (each with one trivial passing smoke test), npm scripts (`test`, `test:e2e`), dev deps (vitest, @vitest/coverage or none, playwright, @playwright/test, @testing-library/react + jsdom for component tests)
- **TDD tests:** one trivial unit smoke test + one trivial component render test (proves jsdom setup) + one Playwright smoke spec (loads `/`, expects HTTP 200) marked to run only when dev server is up.
- **Context Package:** ADR-001 §4 step 5; ADR-000 §10 test-layers table; instruction that `npm test` must run unit+integration and exit 0; Playwright config: `baseURL http://localhost:3000`, `webServer` block starting `npm run dev`; environment facts.
- **Commit:** `Setup: add Vitest and Playwright test infrastructure`

#### P0.3 — Runtime dependencies + fail-fast config module
- **Agent:** be-developer · **Depends on:** P0.2 · **Parallel-safe with:** none (touches package.json)
- **Owned files:** deps (`ai`, `@openrouter/ai-sdk-provider`, `zod`, `better-sqlite3`, `sharp`, `@types/better-sqlite3` if needed), `src/lib/config.ts`, `tests/unit/config.test.ts`
- **TDD tests:** config module returns typed values when all env vars present; **throws a descriptive error naming the missing variable** when any of `OPENROUTER_API_KEY` / `OPENROUTER_TEXT_MODEL` / `OPENROUTER_VISION_MODEL` is absent; `OPENROUTER_MODEL` fallback applies only when `NODE_ENV !== 'production'` (TAC-001-03, TAC-002-04).
- **Context Package:** ADR-000 §7 env table; ADR-002 §3 `providers.ts` paragraph (fallback semantics); `.env.example` variable list; TDD loop; commit rules.
- **Commit:** `Backend: add runtime dependencies and fail-fast env config`

#### P0.4 — Design theme: shadcn/ui + AI Elements + Play brand
- **Agent:** fe-developer · **Depends on:** P0.3 · **Parallel-safe with:** P1.1 (after P0.4's package.json changes are committed — run P1.1 second in the window only after `git pull`-equivalent sync; orchestrator enforces ordering of the two commits)
- **Owned files:** `components.json`, `src/components/ai-elements/**` (generated), `src/components/ui/**` (generated), `src/app/globals.css`, font setup in `src/app/layout.tsx`, `src/app/favicon.ico`, `public/logo.svg`
- **Steps:** `npx shadcn@latest init` then `npx ai-elements@latest` (installs all AI Elements components); map Play design tokens into the shadcn CSS-variables theme in `globals.css`: primary `#6C43BF`, accent/destructive-promo `#E6144B`, dark `#2D0066`, link `#266DD9`, background `#FFFFFF`/`#F5F5F5`/`#FAFAFA`, text `#1F1F1F`/`#404040`/`#707070`, border `#D6D6D6`, radius base 7px; load **Manrope** via `next/font/google` with weights 500/600/700 and set weight 500 as the body default; copy repo `assets/favicon.ico` → `src/app/favicon.ico` and `assets/logo.svg` → `public/logo.svg`.
- **TDD tests:** minimal render test asserting the root layout applies the Manrope font class and that CSS variables for primary color are defined (string-level assertion on globals.css is acceptable).
- **Context Package:** full `docs/design-guidelines.md` (§2–§8) + `assets/design-tokens.json` content; ADR-001 §4 step 4 (CSS Variables mode requirement); ADR-004 §2 component list that must exist after AI Elements install; note that generated `ai-elements`/`ui` components must pass `npm run lint`; environment facts; commit rules.
- **Commit:** `Frontend: init shadcn/ui + AI Elements and apply Play brand theme`

**⛔ GATE 0:** orchestrator verifies build+lint+test green, strict mode on, theme variables present; **manual QA:** starts the dev server, opens `/` via Playwright MCP, screenshots the themed page, verifies Manrope + Play colors against `assets/homepage.png`, zero console errors → unlock Phase 1.

---

### Phase 1 — Core Libraries (be-developer; two parallel windows)

#### P1.1 — Polish copy module + shared form validation schema
- **Agent:** be-developer · **Depends on:** P0.4 · **Parallel-safe with:** P1.2
- **Owned files:** `src/lib/copy/pl.ts`, `src/lib/validation/case-form.schema.ts`, `tests/unit/case-form.schema.test.ts`
- **TDD tests:** schema accepts a fully valid `zwrot` (description optional) and `reklamacja` (description required) payload; rejects: missing each required field, description empty when `reklamacja`, future `purchaseDate` (AC-04), category outside the 7-value enum (AC-02), image wrong MIME / > 10 MB / missing (AC-05, validated as metadata `{ mimeType, sizeBytes }` so the schema is isomorphic client/server); every rejection carries the exact Polish message from `pl.ts`.
- **Context Package:** PRD AC-01..AC-06 verbatim; PRD §9.1/§9.2/§9.3 (all labels, helper texts, button texts, empty/error/loading strings), §11 decision labels + mandatory disclaimer sentence + off-topic redirect — instruction: `pl.ts` must contain **every** user-facing string for the entire app, organized by screen (form/chat/reviewer/decisions/errors), because later tasks import it read-only; ADR-004 §3 "Shared Polish copy" + §6 shared-schema decision; TDD loop; commit rules.
- **Commit:** `Backend: add Polish copy module and shared case-form Zod schema`

#### P1.2 — SQLite persistence layer
- **Agent:** be-developer (second instance) · **Depends on:** P0.3 · **Parallel-safe with:** P1.1
- **Owned files:** `src/lib/db/schema.sql`, `src/lib/db/client.ts`, `src/lib/db/cases.ts`, `src/lib/db/case-images.ts`, `src/lib/db/image-analyses.ts`, `src/lib/db/decisions.ts`, `src/lib/db/chat-messages.ts`, `tests/unit/db/*.test.ts`
- **TDD tests (against a temp-file DB per test):** TAC-003-01 (`PRAGMA foreign_keys = 1`); createCase generates unique formatted `case_number` (`HSC-YYYYMMDD-NNNN`, collision-safe for same-day inserts); TAC-003-02 (`needs_review` one-way flag); TAC-003-03 (escalated list filter + `created_at DESC`); FK violation throws on orphan insert; restart durability — close & reopen connection, all rows readable (TAC-003-04); `getCaseWithHistory` returns images/analyses/decisions/messages ordered by `created_at`; large `parts_json` round-trips intact.
- **Context Package:** ADR-003 **entire** §3–§6 (schema tables, indices, interface contracts, one-way-flag + FK decisions); DB file path `app/data/copilot.db` (gitignored), tests must use a temp path injected into `client.ts` (design for injectable path); ctx7 handle `/wiselibs/better-sqlite3`; TDD loop; commit rules.
- **Commit:** `Backend: add SQLite persistence layer with schema and typed repositories`

#### P1.3 — Image compression + storage
- **Agent:** be-developer · **Depends on:** P0.3 · **Parallel-safe with:** P1.4
- **Owned files:** `src/lib/images/compress.ts`, `src/lib/images/storage.ts`, `tests/unit/images/*.test.ts`, `tests/fixtures/gen-basic/*` (tiny generated PNGs made in-test with sharp)
- **TDD tests:** compress a programmatically generated 3000×2000 PNG → output JPEG ≤ 1600px longest edge, quality 80; a 800×600 input is **not** upscaled; output is valid JPEG (sharp metadata check) (TAC-002-02); storage writes to `uploads/<caseId>/<seq>.jpg` and returns the relative path; read-back returns identical bytes; a path containing `..` or resolving outside `uploads/` is rejected (TAC-003-05 groundwork).
- **Context Package:** ADR-002 §6 compression decision (1600px/q80, no upscale); ADR-003 §3 `storage.ts` paragraph + §6 "images not in public/" decision; ctx7 handle `/lovell/sharp`; TDD loop; commit rules.
- **Commit:** `Backend: add sharp image compression and case image storage`

#### P1.4 — Policy document loader
- **Agent:** be-developer (second instance) · **Depends on:** P0.3 · **Parallel-safe with:** P1.3
- **Owned files:** `src/lib/policies/loader.ts`, `tests/unit/policies.test.ts`
- **TDD tests:** `loadPolicy('zwrot')` returns the full markdown of `docs/policies/zasady-zwrotow.md` (repo root, resolved relative to the app root at runtime, not bundled); `loadPolicy('reklamacja')` → `zasady-reklamacji.md`; missing file throws a descriptive error; content is read fresh (no stale cache across test edits, or an explicitly documented cache-with-invalidation — simplest: read per call).
- **Context Package:** ADR-000 §8 policy-documents decision (path semantics + serverless caveat); PRD §8 external-documents table; the two policy file paths; TDD loop; commit rules.
- **Commit:** `Backend: add policy document loader`

#### P1.5 — AI layer: schemas, prompts, providers, pipeline
- **Agent:** be-developer · **Depends on:** P1.3, P1.4 (and P0.3) · **Parallel-safe with:** none in Phase 1 (imports from several lib modules; run alone)
- **Owned files:** `src/lib/ai/schemas.ts`, `src/lib/ai/prompts/*.ts`, `src/lib/ai/providers.ts`, `src/lib/ai/image-analysis.ts`, `src/lib/ai/decision-agent.ts`, `src/lib/ai/errors.ts` (`AiProviderError`), `tests/unit/ai/*.test.ts`
- **TDD tests (AI SDK mock provider, zero real network):** `ImageAnalysisSchema`/`DecisionSchema` validate/reject fixtures; prompt builders: complaint prompt mentions damage-cause assessment & includes form description, return prompt mentions usage-signs/resellability, decision system prompt embeds policy markdown + disclaimer + off-topic rule + Polish-only instruction and differs correctly per request type; `providers.ts` throws on missing model vars (reuses config from P0.3); `analyzeImage` sends one text part + one `image/jpeg` file part and returns a validated object; `decideInitial` returns a validated Decision; provider failure → `AiProviderError`; static test: no file in `src/` imports `generateObject` (TAC-002-01).
- **Context Package:** ADR-002 **entire document** (it is the spec for exactly these files); PRD §11 full agent behavior spec (allowed/not-allowed/decision table/disclaimer/off-topic/tone — these go into the decision system prompt); pointer that Polish strings come from `pl.ts` where customer-facing; ctx7 handles `/vercel/ai`, `/openrouterteam/ai-sdk-provider`; explicit note: use `generateText` + `output: Output.object(...)`, never `generateObject`; TDD loop; commit rules.
- **Commit:** `Backend: add AI layer (schemas, prompts, OpenRouter providers, two-stage pipeline)`

**⛔ GATE 1:** all unit tests green; orchestrator spot-checks that `pl.ts` covers all PRD strings and prompts embed policy text; **manual QA:** dev server still boots cleanly and `/` renders unchanged (screenshot, console clean) → unlock Phase 2.

---

### Phase 2 — API Routes (be-developer, sequential; P2.2∥P2.4 allowed)

#### P2.1 — `POST /api/cases` (create case → first decision)
- **Agent:** be-developer · **Depends on:** P1.1, P1.2, P1.3, P1.5 · **Parallel-safe with:** none
- **Owned files:** `src/app/api/cases/route.ts`, `tests/integration/cases-post.test.ts`
- **TDD tests (real temp SQLite + real fs, mocked AI functions):** valid `zwrot` multipart → 200 with `{ caseId, caseNumber, decision{status, justification, nextSteps, disclaimer}, requiresBetterPhoto:false }`, rows exist in cases/case_images/image_analyses/decisions + first assistant chat message persisted (AC-20 content assembled from decision + `pl.ts` greeting); `reklamacja` without description → 400 with the field's Polish message and **zero AI calls** (TAC-07 analog); oversized/wrong-MIME image → 400, zero AI calls; inconclusive analysis → 200 `requiresBetterPhoto:true`, no decision row; `needs_human_review` decision → `cases.needs_review = 1`; AI failure → 502 `{ retryable:true }` with case+image already persisted; **retry contract**: the route accepts an optional `caseId` (or a `retry` flag per its own documented design) so a retry re-runs only the AI pipeline against the stored image, without a second image upload — behavior covered by a test (persistence failure isolation AC-35: decision still returned when a non-critical insert fails, error logged).
- **Context Package:** ADR-000 §6 `POST /api/cases` contract verbatim + §9.3 sequence diagrams "Form submission" and "LLM error and retry"; PRD AC-06/07, AC-10..14, AC-20, AC-32/33/35; interfaces of P1 modules (the orchestrator pastes the exported function signatures from the committed P1 files); TDD loop; commit rules.
- **Commit:** `Backend: add POST /api/cases with two-stage AI pipeline and retry`

#### P2.2 — `GET /api/cases/[caseId]` + image-serving route
- **Agent:** be-developer · **Depends on:** P1.2, P1.3 · **Parallel-safe with:** P2.4
- **Owned files:** `src/app/api/cases/[caseId]/route.ts`, `src/app/api/images/[...path]/route.ts` (or equivalent single route, agent's choice within ADR-003 §6), `tests/integration/cases-get.test.ts`, `tests/integration/images-route.test.ts`
- **TDD tests:** existing case → 200 full state (form data, images, analyses, decision history, transcript, ordered); unknown id → 404; image route: stored file → 200 correct bytes + `image/jpeg`; missing → 404; `..`-traversal → 400/404 never file contents (TAC-003-05).
- **Context Package:** ADR-000 §6 `GET /api/cases/[caseId]` contract; ADR-003 §3 storage + §6 route-handler-not-public decision + §8 image-serving scenarios; P1.2/P1.3 exported signatures; TDD loop; commit rules.
- **Commit:** `Backend: add case detail endpoint and protected image serving route`

#### P2.3 — `POST /api/cases/[caseId]/chat` (streaming)
- **Agent:** be-developer · **Depends on:** P2.1 · **Parallel-safe with:** P3.1 (disjoint files)
- **Owned files:** `src/app/api/cases/[caseId]/chat/route.ts`, `src/lib/ai/stream-chat.ts` (if the agent splits logic out of `decision-agent.ts`, allowed), `tests/integration/chat-route.test.ts`
- **TDD tests (mock streaming provider):** returns a UI-message stream response with >1 chunk (TAC-06); rebuilds context from DB each call (assert prompt contains policy + form + latest analysis when spying on the mocked model call); `submitDecision` tool call in the mocked stream → exactly one new `decisions` row, `isRevision=true` allowed only when a prior decision exists (TAC-002-03); user + assistant messages persisted via `onFinish` (AC-33); incoming message with an image file part → compression + re-analysis run before streaming, new `case_images`+`image_analyses` rows (re-upload flow 4.3); second inconclusive analysis → decision `needs_human_review`; unknown caseId → 404.
- **Context Package:** ADR-000 §6 chat contract + both chat sequence diagrams; ADR-002 §3 "Ongoing chat" + §5 `streamChatTurn` contract; PRD AC-14, AC-21..25, flows 4.3/4.4; P1/P2.1 exported signatures; ctx7 `/vercel/ai` (streamText, tools, toUIMessageStreamResponse, convertToModelMessages); TDD loop; commit rules.
- **Commit:** `Backend: add streaming chat route with submitDecision tool and re-upload analysis`

#### P2.4 — `GET /api/reviewer/cases`
- **Agent:** be-developer (second instance) · **Depends on:** P1.2 · **Parallel-safe with:** P2.2
- **Owned files:** `src/app/api/reviewer/cases/route.ts`, `tests/integration/reviewer-route.test.ts`
- **TDD tests:** only `needs_review=1` cases returned, newest first, exact row shape `{ caseId, caseNumber, createdAt, requestType, category, productName }` (AC-41); zero escalations → `{ cases: [] }` 200.
- **Context Package:** ADR-000 §6 reviewer contract; PRD AC-40/41; P1.2 signatures; TDD loop; commit rules.
- **Commit:** `Backend: add reviewer escalated-cases endpoint`

**⛔ GATE 2:** integration suite green; orchestrator reviews route contracts against ADR-000 §6; **manual QA:** with the dev server running, orchestrator exercises the real routes end to end (submits a real multipart request with a real image to `POST /api/cases`, waits for the real OpenRouter decision, fetches the case state and an image URL, checks the reviewer endpoint) and confirms real persisted rows/files → unlock Phase 3.

---

### Phase 3 — Frontend (fe-developer; P3.1 may overlap P2.3)

#### P3.1 — Request form page
- **Agent:** fe-developer · **Depends on:** P1.1 (schema+copy), P2.1 (contract committed) · **Parallel-safe with:** P2.3
- **Owned files:** `src/app/page.tsx`, `src/components/request-form/**`, `tests/unit/request-form.test.tsx`
- **TDD tests (Testing Library):** renders all AC-01 fields with Polish labels from `pl.ts`; category select has exactly the 7 AC-02 options; description required-marker/helper toggles with request type (AC-03); future date → inline Polish error, no fetch (spy) (AC-04/06); wrong-type/oversized file → immediate inline error (AC-05); valid submit → fetch called with multipart FormData, full-screen "Analizujemy…" state, form disabled (AC-07); 502 retryable response → error panel with "Spróbuj ponownie" that re-sends the same FormData without user re-entry; success → navigation to `/chat/<caseId>` (router mock).
- **Context Package:** PRD §9.1 verbatim + AC-01..07; ADR-004 §3 request-form section + §6 shared-schema decision; P1.1 exports (schema + copy keys); P2.1 request/response contract (from ADR-000 §6 + actual committed response shape); design rules: use theme variables/components from P0.4 (primary button = Play purple, radius 7px, Manrope; centered single-column card `max-w` on `#F5F5F5` page background; responsive per AC-51); explicit DO-NOT: no new deps, no edits to theme files or `pl.ts` (missing string → separate pl.ts-only commit); TDD loop; commit rules.
- **Commit:** `Frontend: add request form with client validation, loading and retry states`

#### P3.2 — Chat page
- **Agent:** fe-developer · **Depends on:** P2.2, P2.3, P3.1 · **Parallel-safe with:** none (may need a pl.ts addition)
- **Owned files:** `src/app/chat/[caseId]/page.tsx`, `src/components/chat/**` (ChatShell, DecisionBlock, ReuploadPromptInput), `tests/unit/chat/*.test.tsx`
- **TDD tests:** hydration renders the persisted first message; a message part of type `tool-submitDecision` renders a DecisionBlock with status label (Zaakceptowane/Odrzucone/Do weryfikacji przez pracownika from `pl.ts`), justification, numbered next steps, disclaimer in smaller text; `isRevision:true` adds the "Zaktualizowana decyzja" label; missing optional fields render gracefully; attachment control visible **iff** latest decision data has `requiresBetterPhoto:true`, derived from messages not local state (TAC-004-02), and toggles off after a conclusive turn; typing indicator + disabled input while streaming; stream error → inline error bubble with retry re-sending last user message (AC-25); case summary bar shows caseNumber/type/product; "Nowe zgłoszenie" asks for confirmation then navigates to `/` (AC-30).
- **Context Package:** PRD §9.2 verbatim + AC-20..25, AC-30; ADR-004 §3 chat section + §7 sequence diagram; ADR-000 §6 GET-case + chat contracts; the exact `submitDecision` tool part type name as implemented in P2.3 (orchestrator pastes it from the committed code); AI Elements component inventory from P0.4 (`Conversation`, `Message`, `MessageResponse`, `PromptInput*`, `usePromptInputAttachments`) + ctx7 `/vercel/ai-elements` for usage; design rules (agent bubbles left on white, user right on `#F5F5F5`, decision block card radius 14px with status-colored edge: approved #6C43BF-tinted, rejected #E6144B-tinted, review #707070-tinted, all text via `pl.ts`); DO-NOT list as P3.1; TDD loop; commit rules.
- **Commit:** `Frontend: add chat page with decision blocks and conditional photo re-upload`

#### P3.3 — Reviewer pages
- **Agent:** fe-developer · **Depends on:** P2.2 (image route), P1.2, P3.2 (reuses DecisionBlock/transcript rendering) · **Parallel-safe with:** none
- **Owned files:** `src/app/reviewer/page.tsx`, `src/app/reviewer/[caseId]/page.tsx`, `src/components/reviewer/**`, `tests/unit/reviewer/*.test.tsx`
- **TDD tests:** list renders escalated cases newest first with AC-41 columns; empty state "Brak zgłoszeń do weryfikacji"; detail renders form data, images via the image route, full decision history, transcript reusing DecisionBlock; no interactive elements besides back navigation (AC-42).
- **Context Package:** PRD §9.3 + AC-40..42; ADR-004 §3 reviewer section + §6 server-components-direct-DB decision; P1.2 `listEscalatedCases`/`getCaseWithHistory` signatures; image route URL shape from P2.2; design rules (simple table on white, `#F5F5F5` row hover, no Play magenta here — neutral utility view); DO-NOT list; TDD loop; commit rules.
- **Commit:** `Frontend: add read-only reviewer list and case detail pages`

**⛔ GATE 3:** unit+integration+build+lint green; **manual QA (full pass):** orchestrator drives the complete customer journey by hand via Playwright MCP — fills the form with real values, uploads a real photo, submits, waits for the real AI decision, reads the decision block, asks a follow-up in chat, checks the reviewer view — screenshotting **every** screen/state and comparing each against `assets/homepage.png` + design tokens; zero console errors on all pages → unlock Phase 4.

---

### Phase 4 — E2E & Hardening (qa-engineer, EXCLUSIVE — no parallel agents)

#### P4.1 — Deterministic test fixtures + form E2E (no LLM)
- **Agent:** qa-engineer · **Depends on:** GATE 3 · **Parallel-safe with:** none
- **Owned files:** `tests/fixtures/**` (generated: `clean-product.jpg` — sharp-rendered box/gradient product-like shape; `damaged-product.jpg` — same with drawn crack lines/noise; `blurry.jpg` — heavy gaussian blur; `oversized.jpg` > 10 MB; `wrong-type.gif`), `tests/fixtures/generate.ts` (regeneration script), `tests/e2e/form-validation.spec.ts`
- **TDD tests (E2E, real app, LLM never reached):** every AC-06 inline error path; AC-04 future date; AC-05 file rejections including the >10 MB and GIF fixtures; valid fill enables submission (stop before submit to avoid LLM); mobile viewport (390px) renders the form usably (AC-51); zero console errors on load.
- **Context Package:** PRD §9.1 + AC-01..07 + AC-50/51; Playwright config location from P0.2; fixture generation approach (sharp, deterministic seeds, committed binaries + script); instruction: selectors via accessible roles/labels (Polish labels from `pl.ts` — paste the relevant keys); TDD loop (spec first, watch it fail against missing selectors, then fix selectors only in tests — production changes must be reported, not made silently: qa may add `data-testid`s in a separate commit but must not change behavior); commit rules.
- **Commit:** `Tests: add generated image fixtures and form validation E2E suite`

#### P4.2 — Happy-path E2E with real LLM (return + complaint)
- **Agent:** qa-engineer · **Depends on:** P4.1 · **Parallel-safe with:** none
- **Owned files:** `tests/e2e/happy-paths.spec.ts`
- **TDD tests:** full return flow (clean-product fixture, purchase date 5 days ago) → chat opens, first message contains case number, a visually distinct decision block, justification text, next-steps list, disclaimer string (assert structure + `pl.ts` disclaimer substring — NOT exact LLM wording); full complaint flow (damaged fixture + description "pęknięty zawias przy normalnym użytkowaniu", date 8 months ago) → decision block present; follow-up chat question in Polish → a streamed non-empty assistant reply arrives; response streaming asserted (content grows across polls or >1 network chunk); each spec tolerant to any of the 3 decision statuses (real LLM) but strict about block structure (AC-13/20 structural assertions).
- **Context Package:** PRD flows 4.1/4.2 + AC-13/20/24; note that OPENROUTER key comes from env and calls cost money — keep to the listed scenarios, no retries-in-loop; timeouts ≥ 60s per LLM step; fixture paths from P4.1; app URLs and selector conventions from P4.1; commit rules.
- **Commit:** `Tests: add real-LLM happy-path E2E for return and complaint flows`

#### P4.3 — Re-upload, escalation, reviewer, durability E2E
- **Agent:** qa-engineer · **Depends on:** P4.2 · **Parallel-safe with:** none
- **Owned files:** `tests/e2e/reupload-escalation.spec.ts`, `tests/e2e/reviewer.spec.ts`, `tests/e2e/durability.spec.ts`
- **TDD tests:** blurry fixture → first response asks for a better photo (attachment control appears, AC-22); upload clean fixture in chat → decision block arrives, control disappears; (escalation path) seed a `needs_human_review` case **via the API directly** if driving the LLM to inconclusive-twice proves flaky — flakiness workaround allowed and documented in the spec; reviewer list shows the escalated case newest-first, detail shows images + transcript, zero console errors and no interactive controls (TAC-004-04); durability: create a case, stop and restart the dev server (Playwright webServer off; script-managed server), `GET /api/cases/:id` still returns full state (TAC-05).
- **Context Package:** PRD flows 4.3/4.5 + AC-14/22/40/41/42/34; API contracts (ADR-000 §6) for direct-API seeding; server start/stop technique on Windows (PowerShell `Start-Process`/`Stop-Process` or Playwright-managed); commit rules.
- **Commit:** `Tests: add re-upload, escalation, reviewer and restart-durability E2E`

#### P4.4 — Defect round(s)
- **Agent:** qa-engineer reports → orchestrator dispatches fixes to be-developer / fe-developer (one agent at a time, scoped to the defect) → qa-engineer re-runs.
- **Process:** qa produces a numbered defect list (repro, expected per PRD/ADR reference, actual). Each fix is its own TDD micro-task: failing test first (unit or E2E), fix, verify, commit `Backend|Frontend: fix <defect>`. Loop until the full suite (unit+integration+E2E+lint+build) is green.
- **Exit:** TAC-01..08 from ADR-000 all verified and checked off in the final report.

---

### Phase 5 — Final audit & docs (be-developer)

#### P5.1 — Docs & consistency polish
- **Agent:** be-developer · **Depends on:** P4.4 · **Owned files:** `app/README.md`, `.env.example` (only if drift found), no code changes
- **Steps:** rewrite `app/README.md` for the implemented stack (run/test/build instructions, env setup, route map); verify `.gitignore` covers `data/`, `uploads/`, `.env`; final full verification run; report TAC checklist.
- **Commit:** `Docs: update app README for implemented stack`

---

## 4. Dependency Matrix

| Task | Depends on | Blocks | Agent | Parallel-safe with |
|---|---|---|---|---|
| P0.1 | — | everything | be | — |
| P0.2 | P0.1 | P0.3+ | be | — |
| P0.3 | P0.2 | P0.4, P1.* | be | — |
| P0.4 | P0.3 | P1.1, P3.* | fe | — (commits before P1.1 starts) |
| P1.1 | P0.4 | P2.1, P3.1 | be | P1.2 |
| P1.2 | P0.3 | P2.1/2/4, P3.3 | be#2 | P1.1 |
| P1.3 | P0.3 | P1.5, P2.1/2 | be | P1.4 |
| P1.4 | P0.3 | P1.5 | be#2 | P1.3 |
| P1.5 | P1.3, P1.4 | P2.1, P2.3 | be | — |
| P2.1 | P1.1/2/3/5 | P2.3, P3.1 | be | — |
| P2.2 | P1.2, P1.3 | P3.2, P3.3 | be | P2.4 |
| P2.4 | P1.2 | P4.3 | be#2 | P2.2 |
| P2.3 | P2.1 | P3.2 | be | P3.1 |
| P3.1 | P1.1, P2.1 | P3.2, P4.1 | fe | P2.3 |
| P3.2 | P2.2, P2.3, P3.1 | P3.3, P4.* | fe | — |
| P3.3 | P2.2, P3.2 | P4.3 | fe | — |
| P4.1 | GATE 3 | P4.2 | qa | — (exclusive) |
| P4.2 | P4.1 | P4.3 | qa | — (exclusive) |
| P4.3 | P4.2 | P4.4 | qa | — (exclusive) |
| P4.4 | P4.3 | P5.1 | qa+be+fe | — (one fixer at a time) |
| P5.1 | P4.4 | done | be | — |

### Parallel windows (max 2 agents, disjoint files)

| Window | Agent A | Agent B | Disjointness guarantee |
|---|---|---|---|
| W1 | P1.1 (be: copy+validation) | P1.2 (be#2: db) | `lib/copy`+`lib/validation` vs `lib/db` |
| W2 | P1.3 (be: images) | P1.4 (be#2: policies) | `lib/images` vs `lib/policies` |
| W3 | P2.2 (be: GET+images route) | P2.4 (be#2: reviewer route) | different route folders + different test files |
| W4 | P2.3 (be: chat route) | P3.1 (fe: form page) | `api/**`+`lib/ai` vs `app/page.tsx`+`components/request-form` |

Everything else is sequential. Phase 4 is single-agent exclusive.

---

## 5. Sequencing Summary (critical path)

P0.1 → P0.2 → P0.3 → P0.4 → [W1] → [W2] → P1.5 → P2.1 → [W3] → [W4] → P3.2 → P3.3 → P4.1 → P4.2 → P4.3 → P4.4 → P5.1

Approx. 21 commits minimum (one per task, plus defect-fix commits in P4.4).

---

## 6. Risks & Mitigations

| Risk | Mitigation in plan |
|---|---|
| Real-LLM E2E flakiness (decision varies) | Structural assertions only; any-status tolerance; direct-API seeding fallback for escalation path (P4.3) |
| Shared-file conflicts between parallel agents | File-ownership table per task; explicit `git add <paths>`; `pl.ts` fully authored up front (P1.1); package.json frozen after P0 |
| AI SDK / AI Elements API drift vs. ADR assumptions | Every AI/UI task's brief mandates ctx7 doc fetch before coding; deviations reported to orchestrator, recorded as ADR amendment if accepted |
| `better-sqlite3`/`sharp` native builds on Windows | Installed and verified in P0.3 (prebuilt binaries expected for Node 24); failure = immediate blocker report, orchestrator decides fallback |
| Port 3000 contention during E2E | Phase 4 exclusivity rule; Playwright `webServer` owns the server except in the durability spec |
| Agents inventing missing Polish copy | `pl.ts` single source (TAC-004-01); missing string = separate pl.ts-only commit, never inline literals |

---

## 7. Definition of Done (PoC)

- All PRD acceptance criteria AC-01..AC-51 demonstrably covered by a test (unit, integration, or E2E) or a documented manual check.
- ADR TACs verified: TAC-01..08 (ADR-000), TAC-001-*, TAC-002-*, TAC-003-*, TAC-004-*.
- `npm run build`, `npm run lint`, `npm test`, `npx playwright test` all green from `app/`.
- App demonstrably works end-to-end with real OpenRouter models on the course VM.
- **Manual QA evidence exists for every gate and for the final state:** orchestrator-taken screenshots of every screen (form incl. error/loading states, chat with decision block, re-upload, reviewer list/detail), zero console errors, and a visual comparison against the Play brand reference (`assets/homepage.png`, design tokens) with any drift resolved.
- Repo history: one focused commit per task, all by the executing agents, none pushed.
