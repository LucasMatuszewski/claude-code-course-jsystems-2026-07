# App — Hardware Service Decision Copilot

Next.js (App Router) application for the course project, scaffolded with `create-next-app`.
See `../docs/PRD.md` and `../docs/ADR/` for product and architecture decisions.

## Getting Started

Copy the repo-root `.env.example` to a repo-root `.env` and set `OPENROUTER_API_KEY`, then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm start` — start the production server
- `npm run lint` — ESLint
- `npm test` — Vitest unit/integration tests
- `npm run test:e2e` — Playwright E2E tests

## Stack decisions (see ADR-000 for details)

- Next.js App Router + TypeScript strict
- Tailwind CSS + shadcn/ui + AI Elements for the chat UI
- Vercel AI SDK + `@openrouter/ai-sdk-provider` for all LLM calls
- Drizzle ORM + better-sqlite3 for persistence (`app/data/`, gitignored)
- sharp for image compression
- Vitest (unit/integration) + Playwright (E2E)

## Project setup checklist (scaffolding history)

- [x] Framework chosen: Next.js (App Router) — ADR-000 D1/D2
- [x] Initialized via `create-next-app`
- [x] TypeScript config (`tsconfig.json`, `strict: true`)
- [x] Package manager: npm
- [x] ESLint config (`eslint.config.mjs`)
- [x] Vitest (unit/integration) + Playwright (E2E) configured
- [x] `.env.example` at repo root; app loads repo-root `.env`
- [x] `.gitignore` includes `app/data/`
- [x] Vercel AI SDK + OpenRouter provider installed
- [x] Design tokens / logo / favicon — see `../assets/`
- [x] Design system doc — `../docs/design-guidelines.md`
- [x] PRD / ADRs — `../docs/PRD.md`, `../docs/ADR/`

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js GitHub repository](https://github.com/vercel/next.js)
