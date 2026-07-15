/**
 * OpenRouter provider setup (ADR-002 §3/§6). Creates a single OpenRouter
 * client and exposes two distinct chat models — vision and text — resolved
 * via `loadConfig` (reused, not duplicated: `OPENROUTER_VISION_MODEL` /
 * `OPENROUTER_TEXT_MODEL`, both falling back to `OPENROUTER_MODEL` only
 * outside production, per ADR-002 §6 "Two specialized OpenRouter models").
 * Throws at call time (fail-fast, ADR-001 TAC-001-03) if a required
 * variable is missing — no request is attempted with an undefined model.
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { loadConfig } from "@/lib/config";

export interface Models {
  visionModel: LanguageModelV4;
  textModel: LanguageModelV4;
}

/**
 * Resolves the OpenRouter client and both chat models from the given env
 * (defaults to `process.env`). Throws a descriptive error (via
 * `loadConfig`) naming the missing variable if the config is invalid.
 */
export function createModels(env: NodeJS.ProcessEnv = process.env): Models {
  const config = loadConfig(env);

  const openrouter = createOpenRouter({
    apiKey: config.openrouterApiKey,
    baseURL: config.openrouterBaseUrl,
  });

  return {
    visionModel: openrouter.chat(config.openrouterVisionModel),
    textModel: openrouter.chat(config.openrouterTextModel),
  };
}
