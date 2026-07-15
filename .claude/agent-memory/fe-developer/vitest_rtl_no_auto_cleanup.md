---
name: vitest-rtl-no-auto-cleanup
description: This project's vitest.config.ts has no test.globals:true, so @testing-library/react's automatic afterEach cleanup does not register — multiple render() calls in one test file leak DOM nodes across tests.
metadata:
  type: project
---

In `app/vitest.config.ts` (Hardware Service Decision Copilot PoC), `test.globals` is not set to `true`, and `app/vitest.setup.ts` only imports `@testing-library/jest-dom/vitest` — it does not call `@testing-library/react`'s `cleanup`. RTL's auto-cleanup relies on detecting a global `afterEach`, which isn't installed here, so without explicit cleanup, every `render()` in a test file accumulates in `document.body`, breaking any query that expects a single match (e.g. `getByRole("button", { name: ... })` throws "multiple elements found") as soon as a file has more than one test that renders a component.

**How to apply:** In any new component test file under `app/tests/unit/**` or `app/tests/integration/**` that calls `render()` more than once (i.e. almost all of them), explicitly import `cleanup` from `@testing-library/react` and `afterEach` from `vitest`, and call `afterEach(cleanup)` (or `afterEach(() => cleanup())`) at the top of the file. Confirmed while building the request-form tests (P3.1) — omitting this caused 5/9 tests to fail with "multiple elements found" until cleanup was added. Relevant for the upcoming P3.2 (chat page) and P3.3 (reviewer pages) component tests in the same repo. Do not fix this globally by editing `vitest.setup.ts`/`vitest.config.ts` unless that file is actually in your owned scope for the task — add the cleanup locally in your own test file instead.
