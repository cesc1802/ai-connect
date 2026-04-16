import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities,
  ProviderConfig,
  AnthropicConfig,
} from "../../core/index.js";
import { ValidationError } from "../../core/index.js";
import { BaseProvider } from "../../providers/base-provider.js";
import { ProviderFactory } from "../provider-factory.js";

// Mock provider for testing
class MockAnthropicProvider extends BaseProvider {
  readonly name = "anthropic" as const;
  readonly models = ["claude-3-opus", "claude-3-sonnet"];

  constructor(public readonly testConfig: AnthropicConfig) {
    super();
  }

  capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tools: true,
      vision: true,
      jsonMode: false,
      maxContextTokens: 200000,
    };
  }

  async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
    return {
      id: "test-id",
      content: "mock response",
      toolCalls: [],
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      model: request.model,
      finishReason: "stop",
      latencyMs: 100,
    };
  }

  async *streamCompletion(): AsyncIterable<StreamChunk> {
    yield { id: "chunk-1", delta: { type: "text", text: "mock" } };
  }
}

describe("ProviderFactory", () => {
  beforeEach(() => {
    // Register mock provider before each test
    ProviderFactory.register("anthropic", MockAnthropicProvider);
  });

  afterEach(() => {
    // Clear registry between tests by re-registering
    // Note: In real code, you might want a clear method
  });

  describe("static register", () => {
    it("should register a provider constructor", () => {
      expect(ProviderFactory.isRegistered("anthropic")).toBe(true);
    });

    it("should report unregistered providers", () => {
      expect(ProviderFactory.isRegistered("openai")).toBe(false);
    });
  });

  describe("static getRegisteredProviders", () => {
    it("should return list of registered provider names", () => {
      const providers = ProviderFactory.getRegisteredProviders();
      expect(providers).toContain("anthropic");
    });
  });

  describe("create", () => {
    it("should create a provider instance", () => {
      const config: ProviderConfig = {
        anthropic: { apiKey: "test-key" },
      };
      const factory = new ProviderFactory(config);
      const provider = factory.create("anthropic");

      expect(provider).toBeInstanceOf(MockAnthropicProvider);
      expect(provider.name).toBe("anthropic");
    });

    it("should cache provider instances", () => {
      const config: ProviderConfig = {
        anthropic: { apiKey: "test-key" },
      };
      const factory = new ProviderFactory(config);
      const provider1 = factory.create("anthropic");
      const provider2 = factory.create("anthropic");

      expect(provider1).toBe(provider2);
    });

    it("should pass config to provider constructor", () => {
      const config: ProviderConfig = {
        anthropic: { apiKey: "my-api-key", baseUrl: "https://custom.api" },
      };
      const factory = new ProviderFactory(config);
      const provider = factory.create("anthropic") as MockAnthropicProvider;

      expect(provider.testConfig.apiKey).toBe("my-api-key");
      expect(provider.testConfig.baseUrl).toBe("https://custom.api");
    });

    it("should throw for unregistered provider", () => {
      const config: ProviderConfig = {
        openai: { apiKey: "test-key" },
      };
      const factory = new ProviderFactory(config);

      expect(() => factory.create("openai")).toThrow(ValidationError);
      expect(() => factory.create("openai")).toThrow(/not registered/);
    });

    it("should throw for unconfigured provider", () => {
      const config: ProviderConfig = {};
      const factory = new ProviderFactory(config);

      expect(() => factory.create("anthropic")).toThrow(ValidationError);
      expect(() => factory.create("anthropic")).toThrow(/required/);
    });

    it("should throw for unknown provider name", () => {
      const config: ProviderConfig = {};
      const factory = new ProviderFactory(config);

      // @ts-expect-error Testing invalid input
      expect(() => factory.create("invalid")).toThrow(ValidationError);
    });
  });

  describe("get", () => {
    it("should return undefined for uncreated provider", () => {
      const config: ProviderConfig = {
        anthropic: { apiKey: "test-key" },
      };
      const factory = new ProviderFactory(config);

      expect(factory.get("anthropic")).toBeUndefined();
    });

    it("should return provider after creation", () => {
      const config: ProviderConfig = {
        anthropic: { apiKey: "test-key" },
      };
      const factory = new ProviderFactory(config);
      const created = factory.create("anthropic");

      expect(factory.get("anthropic")).toBe(created);
    });
  });

  describe("isConfigured", () => {
    it("should return true for configured provider", () => {
      const config: ProviderConfig = {
        anthropic: { apiKey: "test-key" },
      };
      const factory = new ProviderFactory(config);

      expect(factory.isConfigured("anthropic")).toBe(true);
    });

    it("should return false for unconfigured provider", () => {
      const config: ProviderConfig = {};
      const factory = new ProviderFactory(config);

      expect(factory.isConfigured("anthropic")).toBe(false);
    });
  });

  describe("createAll", () => {
    it("should create all configured and registered providers", () => {
      const config: ProviderConfig = {
        anthropic: { apiKey: "test-key" },
        openai: { apiKey: "test-key" }, // Not registered, should be skipped
      };
      const factory = new ProviderFactory(config);
      const providers = factory.createAll();

      expect(providers.size).toBe(1);
      expect(providers.has("anthropic")).toBe(true);
      expect(providers.has("openai")).toBe(false);
    });

    it("should return empty map when no providers configured", () => {
      const config: ProviderConfig = {};
      const factory = new ProviderFactory(config);
      const providers = factory.createAll();

      expect(providers.size).toBe(0);
    });
  });

  describe("disposeAll", () => {
    it("should dispose all created providers", async () => {
      const config: ProviderConfig = {
        anthropic: { apiKey: "test-key" },
      };
      const factory = new ProviderFactory(config);
      factory.create("anthropic");

      await expect(factory.disposeAll()).resolves.toBeUndefined();
      expect(factory.get("anthropic")).toBeUndefined();
    });

    it("should clear provider cache after dispose", async () => {
      const config: ProviderConfig = {
        anthropic: { apiKey: "test-key" },
      };
      const factory = new ProviderFactory(config);
      const provider1 = factory.create("anthropic");
      await factory.disposeAll();
      const provider2 = factory.create("anthropic");

      expect(provider1).not.toBe(provider2);
    });
  });
});
