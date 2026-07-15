import { describe, expect, it } from "vitest";
import { createModels } from "@/lib/ai/providers";

const fullEnv = (): NodeJS.ProcessEnv => ({
  OPENROUTER_API_KEY: "sk-test-key",
  OPENROUTER_TEXT_MODEL: "openai/gpt-4o-mini",
  OPENROUTER_VISION_MODEL: "openai/gpt-4o-mini",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
});

describe("createModels", () => {
  it("resolves a vision model and a text model from a valid env", () => {
    const { visionModel, textModel } = createModels(fullEnv());
    expect(visionModel).toBeDefined();
    expect(textModel).toBeDefined();
    expect(visionModel.modelId).toBe("openai/gpt-4o-mini");
    expect(textModel.modelId).toBe("openai/gpt-4o-mini");
  });

  it("throws when OPENROUTER_API_KEY is missing", () => {
    const env = fullEnv();
    delete env.OPENROUTER_API_KEY;
    expect(() => createModels(env)).toThrow(/OPENROUTER_API_KEY/);
  });

  it("throws when OPENROUTER_TEXT_MODEL is missing (and no dev fallback present)", () => {
    const env = fullEnv();
    delete env.OPENROUTER_TEXT_MODEL;
    expect(() => createModels(env)).toThrow(/OPENROUTER_TEXT_MODEL/);
  });

  it("throws when OPENROUTER_VISION_MODEL is missing (and no dev fallback present)", () => {
    const env = fullEnv();
    delete env.OPENROUTER_VISION_MODEL;
    expect(() => createModels(env)).toThrow(/OPENROUTER_VISION_MODEL/);
  });

  it("throws when both model vars are missing simultaneously", () => {
    const env = fullEnv();
    delete env.OPENROUTER_TEXT_MODEL;
    delete env.OPENROUTER_VISION_MODEL;
    expect(() => createModels(env)).toThrow();
  });

  it("resolves distinct models when vision/text env vars differ", () => {
    const env = fullEnv();
    env.OPENROUTER_TEXT_MODEL = "openai/gpt-4o";
    env.OPENROUTER_VISION_MODEL = "openai/gpt-4o-mini";
    const { visionModel, textModel } = createModels(env);
    expect(textModel.modelId).toBe("openai/gpt-4o");
    expect(visionModel.modelId).toBe("openai/gpt-4o-mini");
  });
});
