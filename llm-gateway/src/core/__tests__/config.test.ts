import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  validateConfig,
  loadConfigFromEnv,
  mergeWithEnvConfig,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_CIRCUIT_BREAKER,
  DEFAULT_RETRY,
  type GatewayConfig,
} from "../config.js";
import { ValidationError } from "../errors.js";

describe("validateConfig", () => {
  it("should pass with valid anthropic config", () => {
    const config: GatewayConfig = {
      providers: {
        anthropic: { apiKey: "test-key" },
      },
    };
    expect(() => validateConfig(config)).not.toThrow();
  });

  it("should pass with valid openai config", () => {
    const config: GatewayConfig = {
      providers: {
        openai: { apiKey: "test-key" },
      },
    };
    expect(() => validateConfig(config)).not.toThrow();
  });

  it("should pass with valid ollama config", () => {
    const config: GatewayConfig = {
      providers: {
        ollama: { baseUrl: "http://localhost:11434" },
      },
    };
    expect(() => validateConfig(config)).not.toThrow();
  });

  it("should pass with valid minimax config", () => {
    const config: GatewayConfig = {
      providers: {
        minimax: { apiKey: "test-key", groupId: "test-group" },
      },
    };
    expect(() => validateConfig(config)).not.toThrow();
  });

  it("should throw when no providers configured", () => {
    const config: GatewayConfig = { providers: {} };
    expect(() => validateConfig(config)).toThrow(ValidationError);
    expect(() => validateConfig(config)).toThrow("At least one provider must be configured");
  });

  it("should throw when default provider not configured", () => {
    const config: GatewayConfig = {
      providers: { anthropic: { apiKey: "test" } },
      defaultProvider: "openai",
    };
    expect(() => validateConfig(config)).toThrow(ValidationError);
    expect(() => validateConfig(config)).toThrow("Default provider 'openai' is not configured");
  });

  it("should throw when anthropic missing api key", () => {
    const config: GatewayConfig = {
      providers: { anthropic: { apiKey: "" } },
    };
    expect(() => validateConfig(config)).toThrow("Anthropic API key is required");
  });

  it("should throw when openai missing api key", () => {
    const config: GatewayConfig = {
      providers: { openai: { apiKey: "" } },
    };
    expect(() => validateConfig(config)).toThrow("OpenAI API key is required");
  });

  it("should throw when ollama missing base url", () => {
    const config: GatewayConfig = {
      providers: { ollama: { baseUrl: "" } },
    };
    expect(() => validateConfig(config)).toThrow("Ollama base URL is required");
  });

  it("should throw when minimax missing api key", () => {
    const config: GatewayConfig = {
      providers: { minimax: { apiKey: "", groupId: "test" } },
    };
    expect(() => validateConfig(config)).toThrow("MiniMax API key is required");
  });

  it("should throw when minimax missing group id", () => {
    const config: GatewayConfig = {
      providers: { minimax: { apiKey: "test", groupId: "" } },
    };
    expect(() => validateConfig(config)).toThrow("MiniMax group ID is required");
  });
});

describe("loadConfigFromEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should load anthropic config from env", () => {
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.ANTHROPIC_BASE_URL = "https://custom.anthropic.com";

    const config = loadConfigFromEnv();
    expect(config.anthropic).toEqual({
      apiKey: "test-anthropic-key",
      baseUrl: "https://custom.anthropic.com",
    });
  });

  it("should load openai config from env", () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_ORG_ID = "test-org";
    process.env.OPENAI_BASE_URL = "https://custom.openai.com";

    const config = loadConfigFromEnv();
    expect(config.openai).toEqual({
      apiKey: "test-openai-key",
      organization: "test-org",
      baseUrl: "https://custom.openai.com",
    });
  });

  it("should load ollama config from env", () => {
    process.env.OLLAMA_BASE_URL = "http://localhost:11434";

    const config = loadConfigFromEnv();
    expect(config.ollama).toEqual({
      baseUrl: "http://localhost:11434",
    });
  });

  it("should load minimax config from env", () => {
    process.env.MINIMAX_API_KEY = "test-minimax-key";
    process.env.MINIMAX_GROUP_ID = "test-group";
    process.env.MINIMAX_BASE_URL = "https://custom.minimax.com";

    const config = loadConfigFromEnv();
    expect(config.minimax).toEqual({
      apiKey: "test-minimax-key",
      groupId: "test-group",
      baseUrl: "https://custom.minimax.com",
    });
  });

  it("should not include minimax if only api key set", () => {
    process.env.MINIMAX_API_KEY = "test-key";
    const config = loadConfigFromEnv();
    expect(config.minimax).toBeUndefined();
  });

  it("should return empty config when no env vars set", () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.MINIMAX_API_KEY;

    const config = loadConfigFromEnv();
    expect(config).toEqual({});
  });
});

describe("mergeWithEnvConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should merge env config with provided config", () => {
    process.env.ANTHROPIC_API_KEY = "env-key";

    const config: GatewayConfig = {
      providers: {
        openai: { apiKey: "explicit-key" },
      },
      timeoutMs: 5000,
    };

    const merged = mergeWithEnvConfig(config);
    expect(merged.providers.anthropic?.apiKey).toBe("env-key");
    expect(merged.providers.openai?.apiKey).toBe("explicit-key");
    expect(merged.timeoutMs).toBe(5000);
  });

  it("should prioritize explicit config over env", () => {
    process.env.ANTHROPIC_API_KEY = "env-key";

    const config: GatewayConfig = {
      providers: {
        anthropic: { apiKey: "explicit-key" },
      },
    };

    const merged = mergeWithEnvConfig(config);
    expect(merged.providers.anthropic?.apiKey).toBe("explicit-key");
  });
});

describe("default constants", () => {
  it("should have correct timeout default", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(60_000);
  });

  it("should have correct circuit breaker defaults", () => {
    expect(DEFAULT_CIRCUIT_BREAKER).toEqual({
      failureThreshold: 5,
      resetTimeoutMs: 30_000,
      halfOpenRequests: 3,
    });
  });

  it("should have correct retry defaults", () => {
    expect(DEFAULT_RETRY).toEqual({
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10_000,
      backoffMultiplier: 2,
      retryableErrors: ["TIMEOUT", "RATE_LIMIT", "PROVIDER_ERROR"],
    });
  });
});
