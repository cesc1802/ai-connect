import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LLMGateway, createGateway } from "../gateway.js";
import type { ChatRequest, ChatResponse, StreamChunk, ProviderCapabilities } from "../core/index.js";
import type { LLMProvider } from "../providers/index.js";
import { ProviderFactory } from "../factory/index.js";
import { CircuitState } from "../resilience/index.js";
import { GuardrailBlockedError } from "../core/errors.js";
import { DEFAULT_CHECK_REGISTRY } from "../guardrails/index.js";
import type { GuardrailCheck, GuardrailPolicy } from "../guardrails/index.js";

// Mock init to prevent provider registration side effects
vi.mock("../init.js", () => ({}));

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

    it("stamps the resolved provider kind on the terminal chunk only", async () => {
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

      // Non-terminal chunk carries no provider; terminal (finishReason) chunk does.
      expect(chunks[0]?.provider).toBeUndefined();
      expect(chunks[1]?.provider).toBe("anthropic");
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

    // Regression: long streaming answers used to trip a wall-clock timeout,
    // which marked the provider unhealthy. With idle-reset timing, a stream
    // that keeps emitting chunks must complete past the timeout window AND
    // keep the provider healthy.
    it("idle-reset timeout: long stream emitting chunks does NOT trip circuit", async () => {
      async function* slowButActiveStream(): AsyncIterable<StreamChunk> {
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 30));
          yield { id: String(i), delta: { type: "text", text: "tok" } };
        }
        yield { id: "end", delta: { type: "text", text: "." }, finishReason: "stop" };
      }
      (mockProvider.streamCompletion as ReturnType<typeof vi.fn>).mockReturnValue(
        slowButActiveStream()
      );

      const gateway = new LLMGateway({
        providers: { anthropic: { apiKey: "test-key" } },
        // Total elapsed (~210ms) > timeout (100ms), but no idle gap > 100ms.
        timeoutMs: 100,
        retry: { maxRetries: 0, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, retryableErrors: [] },
      });

      const chunks: StreamChunk[] = [];
      for await (const c of gateway.stream(createTestRequest())) chunks.push(c);

      expect(chunks.length).toBeGreaterThan(0);
      expect(gateway.isProviderHealthy("anthropic")).toBe(true);
      expect(gateway.getMetrics().totalErrors).toBe(0);
    });

    // Regression: streaming idle timeout must be longer than chat() timeout.
    // Long prompts can take 60s+ to produce the first token. A 60s chat()
    // timeout must not apply to streaming time-to-first-token.
    it("stream uses streamIdleTimeoutMs, not the chat timeoutMs", async () => {
      async function* slowFirstChunk(): AsyncIterable<StreamChunk> {
        // Idle gap longer than chat timeout (50ms) but shorter than stream
        // idle timeout (200ms) — must complete without timing out.
        await new Promise((r) => setTimeout(r, 120));
        yield { id: "1", delta: { type: "text", text: "hi" }, finishReason: "stop" };
      }
      (mockProvider.streamCompletion as ReturnType<typeof vi.fn>).mockReturnValue(
        slowFirstChunk()
      );

      const gateway = new LLMGateway({
        providers: { anthropic: { apiKey: "test-key" } },
        timeoutMs: 50,
        streamIdleTimeoutMs: 200,
        retry: { maxRetries: 0, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, retryableErrors: [] },
      });

      const chunks: StreamChunk[] = [];
      for await (const c of gateway.stream(createTestRequest())) chunks.push(c);

      expect(chunks).toHaveLength(1);
      expect(gateway.isProviderHealthy("anthropic")).toBe(true);
    });

    // Regression: client-aborted streams must NOT count as provider failures.
    it("client abort does NOT contribute to circuit failures", async () => {
      const controller = new AbortController();
      async function* abortableStream(signal?: AbortSignal): AsyncIterable<StreamChunk> {
        yield { id: "1", delta: { type: "text", text: "Hi" } };
        await new Promise<void>((_, reject) => {
          if (signal?.aborted) return reject(new Error("aborted"));
          signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
      }
      (mockProvider.streamCompletion as ReturnType<typeof vi.fn>).mockImplementation(
        (_req: ChatRequest, signal?: AbortSignal) => abortableStream(signal)
      );

      const gateway = new LLMGateway({
        providers: { anthropic: { apiKey: "test-key" } },
        circuitBreaker: { failureThreshold: 1, resetTimeoutMs: 60_000, halfOpenRequests: 1 },
        retry: { maxRetries: 0, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, retryableErrors: [] },
      });

      const consume = async (): Promise<void> => {
        for await (const _c of gateway.stream(createTestRequest(), { signal: controller.signal })) {
          // first chunk arrives, then we trigger abort below
          controller.abort();
        }
      };

      await expect(consume()).rejects.toBeDefined();
      // Even with failureThreshold=1, an abort must not trip the circuit.
      expect(gateway.isProviderHealthy("anthropic")).toBe(true);
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

  describe("dynamic provider registry", () => {
    // Private-method access for registry mutation tests; element access is
    // the supported escape hatch and keeps the methods out of the public API.
    type RegistryAccess = {
      registerProvider(name: "anthropic" | "openai", provider: LLMProvider): void;
      unregisterProvider(name: "anthropic" | "openai"): void;
    };

    function setupTwoProviderFactory(): {
      anthropicProvider: LLMProvider;
      openaiProvider: LLMProvider;
    } {
      const anthropicProvider = createMockProvider("anthropic");
      const openaiProvider = createMockProvider("openai");
      (ProviderFactory as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        create: vi.fn().mockImplementation((name: string) => {
          return name === "anthropic" ? anthropicProvider : openaiProvider;
        }),
        disposeAll: vi.fn().mockResolvedValue(undefined),
      }));
      return { anthropicProvider, openaiProvider };
    }

    it("dispose disposes every created provider exactly once", async () => {
      const { anthropicProvider, openaiProvider } = setupTwoProviderFactory();

      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "key1" },
          openai: { apiKey: "key2" },
        },
      });

      await gateway.dispose();

      expect(anthropicProvider.dispose).toHaveBeenCalledTimes(1);
      expect(openaiProvider.dispose).toHaveBeenCalledTimes(1);
      expect(gateway.getProviderNames()).toHaveLength(0);
    });

    it("unregisterProvider removes the provider from names, metrics and routing without disposing it", async () => {
      const { anthropicProvider, openaiProvider } = setupTwoProviderFactory();
      (anthropicProvider.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(
        createTestResponse()
      );

      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "key1" },
          openai: { apiKey: "key2" },
        },
        defaultProvider: "anthropic",
      });

      (gateway as unknown as RegistryAccess).unregisterProvider("openai");

      expect(gateway.getProviderNames()).not.toContain("openai");
      expect(gateway.getMetrics().providers.map((p) => p.name)).not.toContain("openai");
      expect(gateway.getProvider("openai")).toBeUndefined();
      // In-flight streams may still hold the instance: no dispose on unregister.
      expect(openaiProvider.dispose).not.toHaveBeenCalled();

      // Requests explicitly targeting the removed provider fall back to routing.
      const response = await gateway.chat(createTestRequest(), { provider: "openai" });
      expect(response.content).toBe("Hello!");
    });

    it("registerProvider adds a runtime provider that is routable and disposed with the gateway", async () => {
      const { openaiProvider } = setupTwoProviderFactory();
      (openaiProvider.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...createTestResponse(),
        content: "From OpenAI",
      });

      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "key1" },
        },
        defaultProvider: "anthropic",
      });

      (gateway as unknown as RegistryAccess).registerProvider("openai", openaiProvider);

      expect(gateway.getProviderNames()).toContain("openai");
      expect(gateway.isProviderHealthy("openai")).toBe(true);

      const response = await gateway.chat(createTestRequest(), { provider: "openai" });
      expect(response.content).toBe("From OpenAI");

      await gateway.dispose();
      expect(openaiProvider.dispose).toHaveBeenCalledTimes(1);
    });

    it("characterization: two-provider construction yields stable names and metrics shape", () => {
      setupTwoProviderFactory();

      const gateway = new LLMGateway({
        providers: {
          anthropic: { apiKey: "key1" },
          openai: { apiKey: "key2" },
        },
      });

      expect(gateway.getProviderNames()).toEqual(["anthropic", "openai"]);

      const metrics = gateway.getMetrics();
      expect(metrics.providers.map((p) => p.name)).toEqual(["anthropic", "openai"]);
      expect(metrics.providers.every((p) => p.healthy)).toBe(true);
      expect(metrics.providers.every((p) => p.circuit.state === CircuitState.CLOSED)).toBe(true);
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.totalErrors).toBe(0);
      expect(metrics.averageLatencyMs).toBe(0);
    });
  });

  describe("guardrails precheck", () => {
    // Register transient stubs into the gateway's default registry so the SDK
    // wiring is exercised end-to-end; clean them up after each test.
    afterEach(() => {
      delete DEFAULT_CHECK_REGISTRY.injection;
      delete DEFAULT_CHECK_REGISTRY.pii;
    });

    const blockPolicy: GuardrailPolicy = {
      enabled: true,
      checks: [{ kind: "injection", enabled: true, action: "block" }],
    };

    function registerBlock(): void {
      const check: GuardrailCheck = {
        id: "blk",
        kind: "injection",
        async run() {
          return { findings: [{ checkId: "blk", kind: "injection", channel: "message", label: "jailbreak", severity: "high" }] };
        },
      };
      DEFAULT_CHECK_REGISTRY.injection = () => check;
    }

    it("chat() blocks before calling the provider", async () => {
      registerBlock();
      const gateway = new LLMGateway({ providers: { anthropic: { apiKey: "k" } } });

      await expect(gateway.chat(createTestRequest(), { guardrails: blockPolicy })).rejects.toBeInstanceOf(
        GuardrailBlockedError,
      );
      expect(mockProvider.chatCompletion).not.toHaveBeenCalled();
    });

    it("stream() blocks before the first yield (provider stream never started)", async () => {
      registerBlock();
      (mockProvider.streamCompletion as ReturnType<typeof vi.fn>).mockReturnValue(createMockStream());
      const gateway = new LLMGateway({ providers: { anthropic: { apiKey: "k" } } });

      const chunks: StreamChunk[] = [];
      await expect(async () => {
        for await (const c of gateway.stream(createTestRequest(), { guardrails: blockPolicy })) {
          chunks.push(c);
        }
      }).rejects.toBeInstanceOf(GuardrailBlockedError);

      expect(chunks).toHaveLength(0);
      expect(mockProvider.streamCompletion).not.toHaveBeenCalled();
    });

    it("passes the redacted request to the provider when a check transforms it", async () => {
      const redact: GuardrailCheck = {
        id: "red",
        kind: "pii",
        async run({ request }) {
          return {
            findings: [{ checkId: "red", kind: "pii", channel: "message", messageIndex: 0, label: "email", severity: "high" }],
            transformedRequest: {
              ...request,
              messages: request.messages.map((m, i) => (i === 0 ? { ...m, content: "[REDACTED]" } : m)),
            },
          };
        },
      };
      DEFAULT_CHECK_REGISTRY.pii = () => redact;
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(createTestResponse());
      const gateway = new LLMGateway({ providers: { anthropic: { apiKey: "k" } } });

      await gateway.chat(createTestRequest(), {
        guardrails: { enabled: true, checks: [{ kind: "pii", enabled: true, action: "redact" }] },
      });

      const sent = (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mock.calls[0]![0] as ChatRequest;
      expect(sent.messages[0]!.content).toBe("[REDACTED]");
    });

    it("does not invoke guardrails when no policy is supplied", async () => {
      registerBlock(); // registered but unused because options.guardrails is absent
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(createTestResponse());
      const gateway = new LLMGateway({ providers: { anthropic: { apiKey: "k" } } });

      const res = await gateway.chat(createTestRequest());
      expect(res.content).toBe("Hello!");
      expect(mockProvider.chatCompletion).toHaveBeenCalledTimes(1);
    });
  });
});
