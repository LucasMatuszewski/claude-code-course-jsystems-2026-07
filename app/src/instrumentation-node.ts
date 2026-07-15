/**
 * Node.js-runtime-only startup work, imported lazily from `instrumentation.ts`
 * so its Node APIs never reach the Edge Runtime bundle. Runs once at server
 * startup:
 *   1. Load env vars from the repo-root `.env` (one level above `app/`), since
 *      the app must not require its own copy of the file — ADR-000 §7.
 *   2. Fail fast with a clear Polish error when `OPENROUTER_API_KEY` is missing,
 *      instead of an opaque runtime error on the first AI call — ADR-000 §7 /
 *      TAC-02.
 */
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(resolve(process.cwd(), ".."));

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error(
    "Brakuje zmiennej środowiskowej OPENROUTER_API_KEY. Skopiuj plik .env.example " +
      "(w katalogu głównym repozytorium) do .env i uzupełnij klucz OpenRouter " +
      "(https://openrouter.ai/keys)."
  );
}
