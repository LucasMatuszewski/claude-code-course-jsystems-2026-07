import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Two projects per the ADR-000 §10 test strategy:
// - unit: lib/* and components with all external deps mocked.
// - integration: route handlers against real SQLite + real sharp;
//   only the OpenRouter LLM API is mocked (done per-test, not here).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.integration.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/**/*.integration.test.{ts,tsx}"],
        },
      },
    ],
  },
});
