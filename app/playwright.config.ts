import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testDir: "./tests/e2e",
      testIgnore: /durability\.spec\.ts$/,
    },
    {
      // durability.spec.ts kills and restarts the dev server on port 3000
      // mid-test (see that file's header comment). Running it concurrently
      // with any other spec causes real ERR_CONNECTION_REFUSED / interrupted
      // page JS in whichever specs are mid-flight against port 3000 at that
      // moment. `dependencies` forces Playwright to wait for the "chromium"
      // project to fully finish before this project starts, so the restart
      // never overlaps with another spec's requests. `fullyParallel: false`
      // is redundant here (this project has exactly one test) but is kept
      // explicit per the task brief's intent.
      name: "durability",
      use: { ...devices["Desktop Chrome"] },
      testDir: "./tests/e2e",
      testMatch: /durability\.spec\.ts$/,
      dependencies: ["chromium"],
      fullyParallel: false,
    },
  ],
  webServer: {
    command: "npm run dev",
    // Explicit cwd guards against the DEV/dev directory-casing issue on this
    // Windows VM: Next.js crashes if invoked from a differently-cased cwd
    // than the one Node resolved modules from.
    cwd: path.resolve(__dirname),
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
