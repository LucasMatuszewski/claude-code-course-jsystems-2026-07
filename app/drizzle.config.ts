import { defineConfig } from "drizzle-kit";

// ADR-003 D3-02: schema lives in code, drizzle-kit generates versioned SQL
// migrations committed to the repo (see ./drizzle). The app applies them at
// startup in development (src/lib/db/client.ts).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: "./data/copilot.sqlite",
  },
});
