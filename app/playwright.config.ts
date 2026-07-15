import path from "node:path";

import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// Load the real repo-root .env (same file the Next.js app reads at runtime —
// ADR-000 §7) using the same loader Next.js itself uses, so precedence rules
// (.env.local > .env, etc.) match `npm run dev` exactly. A placeholder
// OPENROUTER_API_KEY is fine for infra-only specs; AI-touching E2E specs will
// need a real key to get non-mocked LLM responses (ADR-000 §10 — E2E mocks
// nothing).
loadEnvConfig(path.resolve(__dirname, ".."));

const PORT = process.env.PORT ?? "3000";
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "never" }], ["list"]],

  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  // ADR-002 §8 / TAC-002-03: form and chat must work at both a desktop and a
  // 375 px mobile viewport, with no horizontal scroll.
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone SE"], viewport: { width: 375, height: 667 } },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
