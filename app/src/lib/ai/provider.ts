import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { OpenRouterProvider } from "@openrouter/ai-sdk-provider";
import type { LanguageModelV4 } from "@ai-sdk/provider";

/**
 * OpenRouter provider setup (ADR-001 section 3 "provider", section 6 D1-01).
 *
 * Reads OpenRouter configuration from `process.env` and exposes resolved
 * vision/text language models to the rest of `lib/ai`. The pure resolution
 * function (`resolveModelIds`) takes the env as an argument so unit tests can
 * pass object-literal stubs without mutating the real `process.env`.
 *
 * Fail-fast contract (ADR-000 section 7, TAC-02): a missing API key or a role
 * that cannot resolve any model id throws a typed `OpenRouterConfigError` at
 * first use instead of an opaque 500 from inside a request handler. The error
 * is surfaced at the first AI call rather than at process boot so policy-file
 * or env edits during development do not require a restart to be picked up.
 */

/**
 * Typed configuration error from the OpenRouter provider setup. Thrown when
 * `OPENROUTER_API_KEY` is missing/empty, or when a role cannot resolve any
 * model id (split var unset AND `OPENROUTER_MODEL` unset). Distinct from a
 * generic Error so route handlers can map it to a 500-style configuration
 * response without catching unrelated failures.
 */
export class OpenRouterConfigError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "OpenRouterConfigError";
  }
}

/** Resolved model identifiers for the two AI pipeline roles. */
export interface ResolvedModelIds {
  /** Model id used by `analyzeImage` (vision stage). */
  visionModelId: string;
  /** Model id used by `makeDecision` and the chat agent (text stage). */
  textModelId: string;
}

/**
 * Reads an env value as a non-empty trimmed string. Returns `undefined` when
 * the key is missing OR the value is empty/whitespace-only, so the fallback
 * and "missing" branches in `resolveModelIds` treat both uniformly (ADR-000
 * section 7 — empty strings must not silently select a different code path
 * than a missing variable).
 */
function readEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * Pure: resolves the vision/text model ids from the given env following the
 * fallback chain in ADR-000 section 7:
 *
 *   vision -> OPENROUTER_VISION_MODEL ?? OPENROUTER_MODEL
 *   text   -> OPENROUTER_TEXT_MODEL   ?? OPENROUTER_MODEL
 *
 * Throws `OpenRouterConfigError` when:
 *  - `OPENROUTER_API_KEY` is missing or empty (TAC-02), OR
 *  - either role resolves to no model id at all (split var unset AND
 *    `OPENROUTER_MODEL` unset).
 *
 * @param env - env source; defaults to `process.env` so production callers
 *   read the live environment, while tests pass object-literal stubs.
 */
export function resolveModelIds(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedModelIds {
  const apiKey = readEnv(env, "OPENROUTER_API_KEY");
  if (apiKey === undefined) {
    throw new OpenRouterConfigError(
      "Missing OPENROUTER_API_KEY. Set it in .env (see .env.example); all LLM calls go through OpenRouter.",
    );
  }

  const fallback = readEnv(env, "OPENROUTER_MODEL");
  const visionModelId = readEnv(env, "OPENROUTER_VISION_MODEL") ?? fallback;
  const textModelId = readEnv(env, "OPENROUTER_TEXT_MODEL") ?? fallback;

  const missingRoles: string[] = [];
  if (visionModelId === undefined) {
    missingRoles.push("vision (set OPENROUTER_VISION_MODEL or OPENROUTER_MODEL)");
  }
  if (textModelId === undefined) {
    missingRoles.push("text (set OPENROUTER_TEXT_MODEL or OPENROUTER_MODEL)");
  }
  if (missingRoles.length > 0) {
    throw new OpenRouterConfigError(
      `Missing OpenRouter model id for role(s): ${missingRoles.join("; ")}.`,
    );
  }

  return {
    visionModelId: visionModelId as string,
    textModelId: textModelId as string,
  };
}

/**
 * Reads the optional `OPENROUTER_BASE_URL`. Returns `undefined` when unset or
 * empty so the caller can pass the provider default through (ADR-000 section
 * 7). Pure, like `resolveModelIds`.
 */
export function resolveBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return readEnv(env, "OPENROUTER_BASE_URL");
}

// --- Runtime accessors (read `process.env`; cheap, no caching) ---------------

/**
 * Returns the OpenRouter provider built from the current env (D1-01). Reads
 * env on every call so a developer editing `.env` between requests does not
 * need to restart the dev server to pick up a new key, base URL, or model
 * (consistent with the no-caching rule for policy files, ADR-001 section 3).
 *
 * Construction is cheap (the provider is a factory; no network happens until
 * a model call is made), so caching is unnecessary at MVP scale.
 */
export function getOpenRouterProvider(): OpenRouterProvider {
  // Validates key + model ids first so our typed error message surfaces
  // before `createOpenRouter` would emit a generic one.
  resolveModelIds(process.env);
  const baseURL = resolveBaseUrl(process.env);
  return createOpenRouter(baseURL !== undefined ? { baseURL } : {});
}

/**
 * Returns the resolved vision/text model ids from the current env. Test
 * helper (TAC-001-05): swapping `OPENROUTER_VISION_MODEL` /
 * `OPENROUTER_TEXT_MODEL` swaps the returned ids without code changes.
 */
export function getResolvedModelIds(): ResolvedModelIds {
  return resolveModelIds(process.env);
}

/** Resolved vision language model for the current env (vision stage). */
export function getVisionModel(): LanguageModelV4 {
  const { visionModelId } = resolveModelIds(process.env);
  return getOpenRouterProvider().languageModel(visionModelId);
}

/** Resolved text language model for the current env (decision + chat stages). */
export function getTextModel(): LanguageModelV4 {
  const { textModelId } = resolveModelIds(process.env);
  return getOpenRouterProvider().languageModel(textModelId);
}
