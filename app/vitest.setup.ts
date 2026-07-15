import path from "node:path";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { loadEnvConfig } from "@next/env";
import { afterEach, expect } from "vitest";

// NOTE: `@testing-library/jest-dom/vitest` (as of v6.9.1) does not register
// matchers correctly against Vitest 4's `@vitest/expect` — extend manually
// via the matchers export instead.
expect.extend(matchers);

// React Testing Library does not auto-unmount between tests under Vitest, so
// mounted components accumulate in the shared jsdom document and duplicate-DOM
// queries (e.g. getByRole) fail. Unmount after every test.
afterEach(() => {
  cleanup();
});

// Load env vars from the repo-root .env (one level above app/) so
// integration tests see the same configuration as the running app.
// See ADR-000 §7.
loadEnvConfig(path.resolve(process.cwd(), ".."));
