/**
 * Next.js calls `register()` once when a new server instance starts, before
 * any request is handled (and it is skipped during `next build`). We use it
 * to:
 *   1. Load env vars from the repo-root `.env` (one level above `app/`),
 *      since the app must not require its own copy of the file — ADR-000 §7.
 *   2. Fail fast with a clear Polish error when `OPENROUTER_API_KEY` is
 *      missing, instead of an opaque runtime error on the first AI call —
 *      ADR-000 §7 / TAC-02.
 *
 * All Node-only imports are dynamic and gated behind the runtime check so
 * this file can still be statically analyzed for the Edge runtime bundle
 * without triggering "Node.js API used in Edge Runtime" build warnings.
 *
 * See: https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const [{ loadEnvConfig }, { resolve }] = await Promise.all([
    import("@next/env"),
    import("node:path"),
  ]);
  loadEnvConfig(resolve(process.cwd(), ".."));

  assertRequiredEnv();
}

function assertRequiredEnv() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "Brakuje zmiennej środowiskowej OPENROUTER_API_KEY. Skopiuj plik .env.example " +
        "(w katalogu głównym repozytorium) do .env i uzupełnij klucz OpenRouter " +
        "(https://openrouter.ai/keys)."
    );
  }
}
