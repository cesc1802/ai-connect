import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as configModule from "./config.js";
import { loadConfig } from "./config.js";

const MANAGED_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "OLLAMA_BASE_URL",
  "MINIMAX_API_KEY",
  "PROVIDER_REFRESH_TTL_MS",
  "JWT_SECRET",
  "NODE_ENV",
] as const;

describe("loadConfig", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const key of MANAGED_ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    process.env.JWT_SECRET = "a-test-jwt-secret-of-at-least-32-chars";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("parses without any provider API key env vars", () => {
    expect(() => loadConfig()).not.toThrow();
  });

  it("does not carry provider API keys on the config", () => {
    process.env.ANTHROPIC_API_KEY = "sk-should-be-ignored";
    const config = loadConfig();
    expect(config).not.toHaveProperty("ANTHROPIC_API_KEY");
  });

  it("defaults PROVIDER_REFRESH_TTL_MS to 60000", () => {
    expect(loadConfig().PROVIDER_REFRESH_TTL_MS).toBe(60_000);
  });

  it("parses PROVIDER_REFRESH_TTL_MS from the environment", () => {
    process.env.PROVIDER_REFRESH_TTL_MS = "1500";
    expect(loadConfig().PROVIDER_REFRESH_TTL_MS).toBe(1500);
  });

  it("rejects a non-positive PROVIDER_REFRESH_TTL_MS", () => {
    process.env.PROVIDER_REFRESH_TTL_MS = "0";
    expect(() => loadConfig()).toThrow(/PROVIDER_REFRESH_TTL_MS/);
  });

  it("no longer exports env-var provider extraction", () => {
    expect(configModule).not.toHaveProperty("extractProviderConfigs");
  });
});
