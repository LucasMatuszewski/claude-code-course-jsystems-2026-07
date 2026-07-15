/**
 * Fail-fast application configuration.
 *
 * Reads and validates the environment contract defined in `.env.example`
 * (see ADR-000 §7 and ADR-002 §3/§6). `loadConfig` performs a lazy, explicit
 * read — nothing runs at module import time — so callers control exactly
 * when validation happens (and tests can supply an arbitrary env object).
 *
 * Fallback semantics (ADR-002 §3, verbatim): the vision model comes from
 * `OPENROUTER_VISION_MODEL` and the text model from `OPENROUTER_TEXT_MODEL`,
 * both falling back to `OPENROUTER_MODEL` only outside production.
 */

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_PORT = 3000;

export interface AppConfig {
  openrouterApiKey: string;
  openrouterBaseUrl: string;
  openrouterTextModel: string;
  openrouterVisionModel: string;
  port: number;
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Resolves a model variable that may fall back to `OPENROUTER_MODEL`
 * outside production. Throws naming `name` if neither is set (or if
 * `NODE_ENV === 'production'` and `name` itself is unset).
 */
function resolveModel(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (value) {
    return value;
  }

  const isProduction = env.NODE_ENV === "production";
  const fallback = env.OPENROUTER_MODEL;
  if (!isProduction && fallback) {
    return fallback;
  }

  throw new Error(`Missing required environment variable: ${name}`);
}

/**
 * Loads and validates the application configuration from the given env
 * object (defaults to `process.env`). Throws a descriptive error naming
 * the missing variable if a required value is absent — never lets an
 * undefined key/model reach OpenRouter (ADR-001 TAC-001-03).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const openrouterApiKey = requireEnv(env, "OPENROUTER_API_KEY");
  const openrouterTextModel = resolveModel(env, "OPENROUTER_TEXT_MODEL");
  const openrouterVisionModel = resolveModel(env, "OPENROUTER_VISION_MODEL");
  const openrouterBaseUrl = env.OPENROUTER_BASE_URL ?? DEFAULT_OPENROUTER_BASE_URL;
  const port = env.PORT ? Number(env.PORT) : DEFAULT_PORT;

  return {
    openrouterApiKey,
    openrouterBaseUrl,
    openrouterTextModel,
    openrouterVisionModel,
    port,
  };
}
