---
name: ai-elements-lint-type-fixes
description: ai-elements/shadcn generated code needs known minimal fixes for Next 16 strict lint rules and current `ai` SDK v7 types
metadata:
  type: project
---

Running `npx ai-elements@latest` (installs all 72 components) against this project's Next 16 + `ai@^7.0.28` combo produces vendor code that fails `npm run lint` (17 errors) and `npm run build` type-checking out of the box. Fixed once in commit `b228507` (P0.4); if components are re-generated/updated (`--reinstall`), the same classes of error will likely reappear.

**Why:** `eslint-config-next` 16.2.10 enables newer `react-hooks/*` rules (`set-state-in-effect`, `refs`, `immutability`, `static-components`) that flag several legitimate vendor patterns (ref-during-render prop-change detection, Rive's mutable `.value` API, a memoized-but-dynamically-invoked motion component factory, initial `setState` calls inside setup effects). Separately, the installed `ai@7.0.28` package has a different `LanguageModelUsage`/`Tool` shape than what ai-elements' `context.tsx`/`agent.tsx`/`schema-display.tsx` expect (`usage.reasoningTokens` → `usage.outputTokenDetails.reasoningTokens`, `usage.cachedInputTokens` → `usage.inputTokenDetails.cacheReadTokens`, `tool.description` can be a function not just a string, `schema-display.tsx`'s `dangerouslySetInnerHTML` needs a string guard).

**How to apply:** Fix these with targeted `// eslint-disable-next-line <rule>` (or block `/* eslint-disable */ ... /* eslint-enable */` for multi-line spans) plus a one-line justification comment, not by rewriting the vendor logic. Gotcha: place the disable comment as the *last* comment line immediately before the code line it targets — `eslint-disable-next-line` disables only the literal next line, so stacking multiple explanatory comment lines above it pushes the directive off target (a real mistake made and caught via re-running lint during [[p0.4-design-theme]]). For the `ai` SDK type mismatches, fix with minimal null-safe field renames/guards at the call site, not by changing the `ai` package version.
