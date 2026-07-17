import { describe, expect, it } from "vitest";
import {
  OpenRouterConfigError,
  resolveBaseUrl,
  resolveModelIds,
} from "./provider";

// --- Env fixture -------------------------------------------------------------

const BASE_ENV: Record<string, string> = {
  OPENROUTER_API_KEY: "sk-or-v1-test",
  OPENROUTER_MODEL: "openai/gpt-5.4-mini",
  OPENROUTER_VISION_MODEL: "openai/vision-mock",
  OPENROUTER_TEXT_MODEL: "openai/text-mock",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
};

/**
 * Builds a fresh env object for `resolveModelIds` so tests never mutate
 * `process.env` and never leak state between cases. `undefined` deletes the
 * key (simulating an unset variable); empty/whitespace strings are kept
 * verbatim so the "treat empty as unset" rule is exercised.
 */
function envWith(
  overrides: Record<string, string | undefined>,
): NodeJS.ProcessEnv {
  const env: Record<string, string> = { ...BASE_ENV };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return env as NodeJS.ProcessEnv;
}

// --- API key guard (TAC-02: fail fast, not a silent 500) ---------------------

describe("resolveModelIds — API key", () => {
  it("throws OpenRouterConfigError when OPENROUTER_API_KEY is missing (TAC-02)", () => {
    expect(() =>
      resolveModelIds(envWith({ OPENROUTER_API_KEY: undefined })),
    ).toThrow(OpenRouterConfigError);
  });

  it("throws OpenRouterConfigError when OPENROUTER_API_KEY is empty/whitespace", () => {
    expect(() =>
      resolveModelIds(envWith({ OPENROUTER_API_KEY: "   " })),
    ).toThrow(OpenRouterConfigError);
  });

  it("mentions OPENROUTER_API_KEY in the error message so the operator knows what to fix", () => {
    try {
      resolveModelIds(envWith({ OPENROUTER_API_KEY: undefined }));
      throw new Error("expected resolveModelIds to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(OpenRouterConfigError);
      expect((error as Error).message).toMatch(/OPENROUTER_API_KEY/i);
    }
  });

  it("OpenRouterConfigError carries the standard Error shape (name, message)", () => {
    const err = new OpenRouterConfigError("boom");
    expect(err.name).toBe("OpenRouterConfigError");
    expect(err.message).toBe("boom");
    expect(err instanceof Error).toBe(true);
  });
});

// --- Model resolution + fallback (ADR-000 section 7) -------------------------

describe("resolveModelIds — per-role resolution with fallback", () => {
  it("uses OPENROUTER_VISION_MODEL for the vision role when set", () => {
    const ids = resolveModelIds(
      envWith({ OPENROUTER_VISION_MODEL: "anthropic/claude-vision" }),
    );
    expect(ids.visionModelId).toBe("anthropic/claude-vision");
  });

  it("uses OPENROUTER_TEXT_MODEL for the text role when set", () => {
    const ids = resolveModelIds(
      envWith({ OPENROUTER_TEXT_MODEL: "openai/gpt-text" }),
    );
    expect(ids.textModelId).toBe("openai/gpt-text");
  });

  it("falls back to OPENROUTER_MODEL for vision when the split var is unset", () => {
    const ids = resolveModelIds(
      envWith({
        OPENROUTER_VISION_MODEL: undefined,
        OPENROUTER_MODEL: "fallback/model",
      }),
    );
    expect(ids.visionModelId).toBe("fallback/model");
  });

  it("falls back to OPENROUTER_MODEL for text when the split var is unset", () => {
    const ids = resolveModelIds(
      envWith({
        OPENROUTER_TEXT_MODEL: undefined,
        OPENROUTER_MODEL: "fallback/model",
      }),
    );
    expect(ids.textModelId).toBe("fallback/model");
  });

  it("split vars take precedence over OPENROUTER_MODEL (TAC-001-05)", () => {
    const ids = resolveModelIds(
      envWith({
        OPENROUTER_MODEL: "fallback",
        OPENROUTER_VISION_MODEL: "vision/role",
        OPENROUTER_TEXT_MODEL: "text/role",
      }),
    );
    expect(ids).toEqual({
      visionModelId: "vision/role",
      textModelId: "text/role",
    });
  });

  it("changing OPENROUTER_VISION_MODEL switches the resolved vision id without code changes (TAC-001-05)", () => {
    const a = resolveModelIds(envWith({ OPENROUTER_VISION_MODEL: "model-a" }));
    const b = resolveModelIds(envWith({ OPENROUTER_VISION_MODEL: "model-b" }));
    expect(a.visionModelId).toBe("model-a");
    expect(b.visionModelId).toBe("model-b");
  });

  it("changing OPENROUTER_TEXT_MODEL switches the resolved text id without code changes (TAC-001-05)", () => {
    const a = resolveModelIds(envWith({ OPENROUTER_TEXT_MODEL: "model-a" }));
    const b = resolveModelIds(envWith({ OPENROUTER_TEXT_MODEL: "model-b" }));
    expect(a.textModelId).toBe("model-a");
    expect(b.textModelId).toBe("model-b");
  });

  it("treats empty/whitespace string split vars as unset and falls back to OPENROUTER_MODEL", () => {
    const ids = resolveModelIds(
      envWith({
        OPENROUTER_VISION_MODEL: "",
        OPENROUTER_TEXT_MODEL: "   ",
        OPENROUTER_MODEL: "fallback/model",
      }),
    );
    expect(ids).toEqual({
      visionModelId: "fallback/model",
      textModelId: "fallback/model",
    });
  });
});

// --- Missing model id (both split var AND fallback absent) -------------------

describe("resolveModelIds — missing model id per role", () => {
  it("throws OpenRouterConfigError when vision has neither split var nor fallback", () => {
    expect(() =>
      resolveModelIds(
        envWith({ OPENROUTER_VISION_MODEL: undefined, OPENROUTER_MODEL: undefined }),
      ),
    ).toThrow(OpenRouterConfigError);
  });

  it("throws OpenRouterConfigError when text has neither split var nor fallback", () => {
    expect(() =>
      resolveModelIds(
        envWith({ OPENROUTER_TEXT_MODEL: undefined, OPENROUTER_MODEL: undefined }),
      ),
    ).toThrow(OpenRouterConfigError);
  });

  it("throws OpenRouterConfigError when all model vars are missing even with the key present", () => {
    expect(() =>
      resolveModelIds(
        envWith({
          OPENROUTER_VISION_MODEL: undefined,
          OPENROUTER_TEXT_MODEL: undefined,
          OPENROUTER_MODEL: undefined,
        }),
      ),
    ).toThrow(OpenRouterConfigError);
  });

  it("error message names the missing role(s) when both are missing", () => {
    try {
      resolveModelIds(
        envWith({
          OPENROUTER_VISION_MODEL: undefined,
          OPENROUTER_TEXT_MODEL: undefined,
          OPENROUTER_MODEL: undefined,
        }),
      );
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(OpenRouterConfigError);
      const msg = (error as Error).message;
      expect(msg).toMatch(/vision/i);
      expect(msg).toMatch(/text/i);
    }
  });
});

// --- Base URL resolution (optional) ------------------------------------------

describe("resolveBaseUrl", () => {
  it("returns OPENROUTER_BASE_URL when set", () => {
    expect(
      resolveBaseUrl(envWith({ OPENROUTER_BASE_URL: "https://custom.example/api" })),
    ).toBe("https://custom.example/api");
  });

  it("returns undefined when OPENROUTER_BASE_URL is unset (provider default applies)", () => {
    expect(
      resolveBaseUrl(envWith({ OPENROUTER_BASE_URL: undefined })),
    ).toBeUndefined();
  });

  it("returns undefined for empty/whitespace value", () => {
    expect(resolveBaseUrl(envWith({ OPENROUTER_BASE_URL: "   " }))).toBeUndefined();
  });
});
