import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LLMGateway, createGateway } from "../gateway.js";
import type { ChatRequest, ChatResponse, StreamChunk, ProviderCapabilities } from "../core/index.js";
import type { LLMProvider } from "../providers/index.js";
import { ProviderFactory } from "../factory/index.js";
import { CircuitState } from "../resilience/index.js";

// Mock ProviderFactory
vi.mock("../factory/index.js", () => ({
  ProviderFactory: vi.fn().mockImplementation(() => ({
    create: vi.fn(),
    disposeAll: vi.fn().mockResolvedValue(undefined),
  })),
}));

function createMockProvider(name: "anthropic" | "openai" = "anthropic"): LLMProvider {
  return {
    name,
    models: name === "anthropic" ? ["claude-3-opus"] : ["gpt-4"],
    capabilities: vi.fn().mockReturnValue({
      streaming: true,
      tools: true,
      vision: true,
      jsonMode: true,
      maxContextTokens: 100000,
    } as ProviderCapabilities),
    supportsModel: vi.fn().mockReturnValue(true),
    chatCompletion: vi.fn(),
    streamCompletion: vi.fn(),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

function createTestRequest(): ChatRequest {
  return {
    model: "claude-3-opus",
    messages: [{ role: "user", content: "Hello" }],
    maxTokens: 100,
  };
}

function createTestResponse(latencyMs = 100): ChatResponse {
  return {
    id: "test-id",
    content: "Hello!",
    toolCalls: [],
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    model: "claude-3-opus",
    finishReason: "stop",
    latencyMs,
  };
}

async function* createMockStream(): AsyncIterable<StreamChunk> {
  yield { id: "1", delta: { type: "text", text: "Hello" } };
  yield { id: "1", delta: { type: "text", text: " world" }, finishReason: "stop" };
}

describe("LLMGateway", () => {
  let mockProvider: LLMProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = createMockProvider();

    // Setup factory mock to return our mock provider
    (ProviderFactory as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      create: vi.fn().mockReturnValue(mockProvider),
      disposeAll: vi.fn().mockResolvedValue(undefined),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("creates gateway with valid config", () => {
      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
        defaultProvider: "anthropic",
      });

      expect(gateway).toBeDefined();
      expect(gateway.getProviderNames()).toContain("anthropic");
    });

    it("throws on invalid config (no providers)", () => {
      expect(
        () =>
          new LLMGateway({
            providers: {},
          })
      ).toThrow("At least one provider must be configured");
    });

    it("merges env config with explicit config", () => {
      // Mock env
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        ANTHROPIC_API_KEY: "env-key",
      };

      try {
        const gateway = new LLMGateway({
          providers: {
            anthropic: { apiKey: "explicit-key" },
          },
        });

        expect(gateway.getProviderNames()).toContain("anthropic");
      } finally {
        process.env = originalEnv;
      }
    });

    it("uses custom timeout", () => {
      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
        timeoutMs: 30000,
      });

      expect(gateway).toBeDefined();
    });
  });

  describe("chat", () => {
    it("returns response from provider", async () => {
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(
        createTestResponse()
      );

      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
      });

      const response = await gateway.chat(createTestRequest());

      expect(response.content).toBe("Hello!");
      expect(response.latencyMs).toBe(100);
    });

    it("increments total requests", async () => {
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(
        createTestResponse()
      );

      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
      });

      await gateway.chat(createTestRequest());
      await gateway.chat(createTestRequest());

      expect(gateway.getMetrics().totalRequests).toBe(2);
    });

    it("increments error count on failure", async () => {
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("API error")
      );

      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
        retry: { maxRetries: 0, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, retryableErrors: [] },
      });

      await expect(gateway.chat(createTestRequest())).rejects.toThrow("API error");
      expect(gateway.getMetrics().totalErrors).toBe(1);
    });

    it("respects explicit provider option", async () => {
      const anthropicProvider = createMockProvider("anthropic");
      const openaiProvider = createMockProvider("openai");

      let createCallCount = 0;
      (ProviderFactory as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        create: vi.fn().mockImplementation((name: string) => {
          createCallCount++;
          return name === "anthropic" ? anthropicProvider : openaiProvider;
        }),
        disposeAll: vi.fn().mockResolvedValue(undefined),
      }));

      (anthropicProvider.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(
        createTestResponse()
      );
      (openaiProvider.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...createTestResponse(),
        content: "From OpenAI",
      });

      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "key1" },
          openai: { apiKey: "key2" },
        },
        defaultProvider: "anthropic",
      });

      // Request with explicit openai provider
      const response = await gateway.chat(createTestRequest(), { provider: "openai" });
      expect(response.content).toBe("From OpenAI");
    });
  });

  describe("stream", () => {
    it("yields chunks from provider", async () => {
      (mockProvider.streamCompletion as ReturnType<typeof vi.fn>).mockReturnValue(
        createMockStream()
      );

      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of gateway.stream(createTestRequest())) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]?.delta).toEqual({ type: "text", text: "Hello" });
    });

    it("increments request count on stream", async () => {
      (mockProvider.streamCompletion as ReturnType<typeof vi.fn>).mockReturnValue(
        createMockStream()
      );

      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
      });

      for await (const _chunk of gateway.stream(createTestRequest())) {
        // consume stream
      }

      expect(gateway.getMetrics().totalRequests).toBe(1);
    });

    it("records error on stream failure", async () => {
      async function* failingStream(): AsyncIterable<StreamChunk> {
        yield { id: "1", delta: { type: "text", text: "Hi" } };
        throw new Error("stream failed");
      }
      (mockProvider.streamCompletion as ReturnType<typeof vi.fn>).mockReturnValue(failingStream());

      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
        retry: { maxRetries: 0, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, retryableErrors: [] },
      });

      await expect(async () => {
        for await (const _chunk of gateway.stream(createTestRequest())) {
          // consume
        }
      }).rejects.toThrow("stream failed");

      expect(gateway.getMetrics().totalErrors).toBe(1);
    });
  });

  describe("getProvider", () => {
    it("returns provider wrapped in circuit breaker", () => {
      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
      });

      const provider = gateway.getProvider("anthropic");
      expect(provider).toBeDefined();
      expect(provider?.name).toBe("anthropic");
    });

    it("returns undefined for unconfigured provider", () => {
      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
      });

      const provider = gateway.getProvider("openai");
      expect(provider).toBeUndefined();
    });
  });

  describe("getProviderNames", () => {
    it("returns list of configured providers", () => {
      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
      });

      const names = gateway.getProviderNames();
      expect(names).toContain("anthropic");
    });
  });

  describe("isProviderHealthy", () => {
    it("returns true for healthy provider", () => {
      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
      });

      expect(gateway.isProviderHealthy("anthropic")).toBe(true);
    });

    it("returns false for unconfigured provider", () => {
      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
      });

      expect(gateway.isProviderHealthy("openai")).toBe(false);
    });
  });

  describe("getMetrics", () => {
    it("returns gateway metrics", async () => {
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(
        createTestResponse(150)
      );

      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
      });

      await gateway.chat(createTestRequest());

      const metrics = gateway.getMetrics();

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.totalErrors).toBe(0);
      expect(metrics.averageLatencyMs).toBe(150);
      expect(metrics.providers).toHaveLength(1);
      expect(metrics.providers[0]?.name).toBe("anthropic");
      expect(metrics.providers[0]?.healthy).toBe(true);
    });

    it("calculates average latency", async () => {
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(createTestResponse(100))
        .mockResolvedValueOnce(createTestResponse(200))
        .mockResolvedValueOnce(createTestResponse(300));

      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
      });

      await gateway.chat(createTestRequest());
      await gateway.chat(createTestRequest());
      await gateway.chat(createTestRequest());

      const metrics = gateway.getMetrics();
      expect(metrics.averageLatencyMs).toBe(200); // (100 + 200 + 300) / 3
    });

    it("includes circuit breaker metrics", () => {
      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
      });

      const metrics = gateway.getMetrics();
      expect(metrics.providers[0]?.circuit.state).toBe(CircuitState.CLOSED);
    });
  });

  describe("createFallbackChain", () => {
    it("creates fallback chain with valid providers", () => {
      const anthropicProvider = createMockProvider("anthropic");
      const openaiProvider = createMockProvider("openai");

      (ProviderFactory as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        create: vi.fn().mockImplementation((name: string) => {
          return name === "anthropic" ? anthropicProvider : openaiProvider;
        }),
        disposeAll: vi.fn().mockResolvedValue(undefined),
      }));

      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "key1" },
          openai: { apiKey: "key2" },
        },
      });

      const chain = gateway.createFallbackChain(["anthropic", "openai"]);
      expect(chain).toBeDefined();
      expect(chain.getProviders()).toHaveLength(2);
    });

    it("throws on empty fallback chain", () => {
      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
      });

      expect(() => gateway.createFallbackChain(["openai"])).toThrow(
        "No valid providers for fallback chain"
      );
    });
  });

  describe("dispose", () => {
    it("disposes all resources", async () => {
      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
      });

      await gateway.dispose();

      // After dispose, providers should be cleared
      expect(gateway.getProviderNames()).toHaveLength(0);
    });
  });

  describe("createGateway helper", () => {
    it("creates gateway instance", () => {
      const gateway = createGateway({
        providers: {
          anthropic: { apiKey: "test-key" },
        },
      });

      expect(gateway).toBeInstanceOf(LLMGateway);
    });
  });
});
