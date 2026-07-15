import { describe, expect, it } from "vitest";
import { loadConfig } from "@/lib/config";

const fullEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: "test",
  OPENROUTER_API_KEY: "sk-or-test-key",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  OPENROUTER_TEXT_MODEL: "openai/gpt-5.4-mini",
  OPENROUTER_VISION_MODEL: "openai/gpt-5.4-mini",
});

describe("loadConfig", () => {
  it("returns typed config values when all required env vars are present", () => {
    const config = loadConfig(fullEnv());

    expect(config).toEqual({
      openrouterApiKey: "sk-or-test-key",
      openrouterBaseUrl: "https://openrouter.ai/api/v1",
      openrouterTextModel: "openai/gpt-5.4-mini",
      openrouterVisionModel: "openai/gpt-5.4-mini",
      port: 3000,
    });
  });

  it("defaults OPENROUTER_BASE_URL when not provided", () => {
    const env = fullEnv();
    delete env.OPENROUTER_BASE_URL;

    const config = loadConfig(env);

    expect(config.openrouterBaseUrl).toBe("https://openrouter.ai/api/v1");
  });

  it("parses PORT when provided", () => {
    const env = fullEnv();
    env.PORT = "4000";

    const config = loadConfig(env);

    expect(config.port).toBe(4000);
  });

  it("throws a descriptive error naming OPENROUTER_API_KEY when it is missing", () => {
    const env = fullEnv();
    delete env.OPENROUTER_API_KEY;

    expect(() => loadConfig(env)).toThrow(/OPENROUTER_API_KEY/);
  });

  it("throws a descriptive error naming OPENROUTER_TEXT_MODEL when it is missing (no fallback set)", () => {
    const env = fullEnv();
    delete env.OPENROUTER_TEXT_MODEL;

    expect(() => loadConfig(env)).toThrow(/OPENROUTER_TEXT_MODEL/);
  });

  it("throws a descriptive error naming OPENROUTER_VISION_MODEL when it is missing (no fallback set)", () => {
    const env = fullEnv();
    delete env.OPENROUTER_VISION_MODEL;

    expect(() => loadConfig(env)).toThrow(/OPENROUTER_VISION_MODEL/);
  });

  describe("OPENROUTER_MODEL fallback", () => {
    it("fills a missing OPENROUTER_TEXT_MODEL from OPENROUTER_MODEL when NODE_ENV is not production", () => {
      const env = fullEnv();
      delete env.OPENROUTER_TEXT_MODEL;
      env.NODE_ENV = "development";
      env.OPENROUTER_MODEL = "openai/gpt-5.4-mini-fallback";

      const config = loadConfig(env);

      expect(config.openrouterTextModel).toBe("openai/gpt-5.4-mini-fallback");
    });

    it("fills a missing OPENROUTER_VISION_MODEL from OPENROUTER_MODEL when NODE_ENV is not production", () => {
      const env = fullEnv();
      delete env.OPENROUTER_VISION_MODEL;
      env.NODE_ENV = "development";
      env.OPENROUTER_MODEL = "openai/gpt-5.4-mini-fallback";

      const config = loadConfig(env);

      expect(config.openrouterVisionModel).toBe("openai/gpt-5.4-mini-fallback");
    });

    it("does NOT fall back to OPENROUTER_MODEL when NODE_ENV is production, and still throws", () => {
      const env = fullEnv();
      delete env.OPENROUTER_TEXT_MODEL;
      env.NODE_ENV = "production";
      env.OPENROUTER_MODEL = "openai/gpt-5.4-mini-fallback";

      expect(() => loadConfig(env)).toThrow(/OPENROUTER_TEXT_MODEL/);
    });
  });
});
