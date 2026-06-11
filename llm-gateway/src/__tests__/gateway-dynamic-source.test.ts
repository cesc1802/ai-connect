import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LLMGateway } from "../gateway.js";
import type {
  ChatRequest,
  ChatResponse,
  ProviderCapabilities,
  ProviderConfig,
  StreamChunk,
} from "../core/index.js";
import { LLMError, ValidationError } from "../core/index.js";
import type { LLMProvider } from "../providers/index.js";
import { ProviderFactory } from "../factory/index.js";

// Prevent real provider registration; fakes are registered per test below.
vi.mock("../init.js", () => ({}));

type FakeName = "anthropic" | "openai";

interface FakeProvider extends LLMProvider {
  config: unknown;
  chatCompletion: ReturnType<typeof vi.fn>;
  streamCompletion: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

// Instances created per provider name, in creation order, for assertions.
const instances: Record<FakeName, FakeProvider[]> = { anthropic: [], openai: [] };

function createTestResponse(): ChatResponse {
  return {
    id: "test-id",
    content: "Hello!",
    toolCalls: [],
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    model: "test-model",
    finishReason: "stop",
    latencyMs: 100,
  };
}

function makeFakeConstructor(name: FakeName) {
  return class {
    readonly name = name;
    readonly models = ["test-model"];
    config: unknown;
    chatCompletion = vi.fn().mockResolvedValue(createTestResponse());
    streamCompletion = vi.fn();
    capabilities = vi.fn().mockReturnValue({
      streaming: true,
      tools: false,
      vision: false,
      jsonMode: false,
      maxContextTokens: 100000,
    } as ProviderCapabilities);
    supportsModel = vi.fn().mockReturnValue(true);
    dispose = vi.fn().mockResolvedValue(undefined);

    constructor(config: unknown) {
      this.config = config;
      instances[name].push(this as unknown as FakeProvider);
    }
  } as new (config: unknown) => LLMProvider;
}

function createTestRequest(): ChatRequest {
  return {
    model: "test-model",
    messages: [{ role: "user", content: "Hello" }],
    maxTokens: 100,
  };
}

const ENV_KEYS = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OLLAMA_BASE_URL", "MINIMAX_API_KEY"];

describe("LLMGateway dynamic provider source", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.useFakeTimers();
    instances.anthropic = [];
    instances.openai = [];
    ProviderFactory.register("anthropic", makeFakeConstructor("anthropic"));
    ProviderFactory.register("openai", makeFakeConstructor("openai"));
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    for (const key of ENV_KEYS) {
      if (savedEnv[key] !== undefined) process.env[key] = savedEnv[key];
    }
  });

  describe("construction", () => {
    it("throws when both providers and source are configured", () => {
      expect(
        () =>
          new LLMGateway({
            providers: { anthropic: { apiKey: "k" } },
            source: { load: async () => ({}) },
          })
      ).toThrow(ValidationError);
    });

    it("throws when neither providers nor source is configured", () => {
      expect(() => new LLMGateway({})).toThrow("At least one provider must be configured");
    });

    it("allows source mode with zero providers at boot", () => {
      const gateway = new LLMGateway({ source: { load: async () => ({}) } });
      expect(gateway.getProviderNames()).toEqual([]);
    });
  });

  describe("TTL refresh-on-use", () => {
    it("loads providers from the source on first request and reuses them within the TTL", async () => {
      const load = vi.fn().mockResolvedValue({ anthropic: { apiKey: "k1" } } as ProviderConfig);
      const gateway = new LLMGateway({ source: { load }, refreshTtlMs: 60_000 });

      await gateway.chat(createTestRequest());
      await gateway.chat(createTestRequest());
      expect(load).toHaveBeenCalledTimes(1);
      expect(instances.anthropic).toHaveLength(1);
      expect(gateway.getProviderNames()).toEqual(["anthropic"]);

      vi.advanceTimersByTime(60_000);
      await gateway.chat(createTestRequest());
      expect(load).toHaveBeenCalledTimes(2);
    });

    it("deduplicates concurrent requests into a single load", async () => {
      let resolveLoad!: (config: ProviderConfig) => void;
      const load = vi.fn(
        () =>
          new Promise<ProviderConfig>((resolve) => {
            resolveLoad = resolve;
          })
      );
      const gateway = new LLMGateway({ source: { load } });

      const calls = [
        gateway.chat(createTestRequest()),
        gateway.chat(createTestRequest()),
        gateway.chat(createTestRequest()),
      ];
      resolveLoad({ anthropic: { apiKey: "k1" } });
      await Promise.all(calls);

      expect(load).toHaveBeenCalledTimes(1);
      expect(instances.anthropic).toHaveLength(1);
    });

    it("does not merge env provider config in source mode", async () => {
      process.env.ANTHROPIC_API_KEY = "env-key";
      const load = vi.fn().mockResolvedValue({} as ProviderConfig);
      const gateway = new LLMGateway({ source: { load } });

      await expect(gateway.chat(createTestRequest())).rejects.toThrow();
      expect(load).toHaveBeenCalledTimes(1);
      expect(gateway.getProviderNames()).toEqual([]);
    });
  });

  describe("config diffing", () => {
    it("keeps the same instance and circuit-breaker state when config is unchanged", async () => {
      const load = vi.fn().mockResolvedValue({ anthropic: { apiKey: "k1" } } as ProviderConfig);
      const gateway = new LLMGateway({
        source: { load },
        refreshTtlMs: 1_000,
        circuitBreaker: { failureThreshold: 1, resetTimeoutMs: 600_000, halfOpenRequests: 1 },
      });

      await gateway.chat(createTestRequest());
      const provider = instances.anthropic[0]!;

      // Trip the breaker.
      provider.chatCompletion.mockRejectedValue(new Error("boom"));
      await expect(gateway.chat(createTestRequest())).rejects.toThrow("boom");
      expect(gateway.getMetrics().providers[0]?.circuit.state).toBe("open");

      // Refresh with identical config: same instance, breaker still open.
      vi.advanceTimersByTime(1_000);
      await expect(gateway.chat(createTestRequest())).rejects.toThrow();
      expect(load).toHaveBeenCalledTimes(2);
      expect(instances.anthropic).toHaveLength(1);
      expect(gateway.getMetrics().providers[0]?.circuit.state).toBe("open");
    });

    it("swaps to a new instance on config change and defers disposing the old one", async () => {
      const load = vi
        .fn()
        .mockResolvedValueOnce({ anthropic: { apiKey: "k1" } } as ProviderConfig)
        .mockResolvedValue({ anthropic: { apiKey: "k2" } } as ProviderConfig);
      const gateway = new LLMGateway({
        source: { load },
        refreshTtlMs: 1_000,
        streamIdleTimeoutMs: 5_000,
      });

      await gateway.chat(createTestRequest());
      const first = instances.anthropic[0]!;

      vi.advanceTimersByTime(1_000);
      await gateway.chat(createTestRequest());

      expect(instances.anthropic).toHaveLength(2);
      expect(instances.anthropic[1]!.chatCompletion).toHaveBeenCalledTimes(1);
      expect(first.dispose).not.toHaveBeenCalled();

      vi.advanceTimersByTime(4_999);
      expect(first.dispose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(first.dispose).toHaveBeenCalledTimes(1);
    });

    it("removes providers dropped by the source and defers their dispose", async () => {
      const load = vi
        .fn()
        .mockResolvedValueOnce({
          anthropic: { apiKey: "k1" },
          openai: { apiKey: "k2" },
        } as ProviderConfig)
        .mockResolvedValue({ anthropic: { apiKey: "k1" } } as ProviderConfig);
      const gateway = new LLMGateway({
        source: { load },
        refreshTtlMs: 1_000,
        streamIdleTimeoutMs: 5_000,
      });

      await gateway.chat(createTestRequest(), { provider: "openai" });
      expect(instances.openai[0]!.chatCompletion).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1_000);
      await gateway.chat(createTestRequest());

      expect(gateway.getProviderNames()).toEqual(["anthropic"]);
      expect(instances.anthropic).toHaveLength(1);
      const removed = instances.openai[0]!;
      expect(removed.dispose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(5_000);
      expect(removed.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe("graceful swap with in-flight streams", () => {
    it("lets an in-flight stream finish on the old instance while new requests use the new one", async () => {
      const load = vi
        .fn()
        .mockResolvedValueOnce({ anthropic: { apiKey: "k1" } } as ProviderConfig)
        .mockResolvedValue({ anthropic: { apiKey: "k2" } } as ProviderConfig);
      const gateway = new LLMGateway({
        source: { load },
        refreshTtlMs: 1_000,
        streamIdleTimeoutMs: 120_000,
      });

      // Materialize the first instance, then arm its stream.
      await gateway.chat(createTestRequest());
      const first = instances.anthropic[0]!;

      let releaseStream!: () => void;
      const gate = new Promise<void>((resolve) => {
        releaseStream = resolve;
      });
      first.streamCompletion.mockImplementation(async function* (): AsyncIterable<StreamChunk> {
        yield { id: "1", delta: { type: "text", text: "first" } };
        await gate;
        yield { id: "1", delta: { type: "text", text: "rest" }, finishReason: "stop" };
      });

      const iterator = gateway.stream(createTestRequest())[Symbol.asyncIterator]();
      const firstChunk = await iterator.next();
      expect(firstChunk.value?.delta).toEqual({ type: "text", text: "first" });

      // Swap happens while the stream is mid-flight.
      vi.advanceTimersByTime(1_000);
      await gateway.chat(createTestRequest());
      expect(instances.anthropic).toHaveLength(2);
      expect(instances.anthropic[1]!.chatCompletion).toHaveBeenCalledTimes(1);
      expect(first.dispose).not.toHaveBeenCalled();

      // The old stream still completes on the displaced instance.
      releaseStream();
      const secondChunk = await iterator.next();
      expect(secondChunk.value?.delta).toEqual({ type: "text", text: "rest" });
      const done = await iterator.next();
      expect(done.done).toBe(true);
      expect(first.dispose).not.toHaveBeenCalled();
    });
  });

  describe("source failure handling", () => {
    it("applies a refresh atomically: one failing provider leaves the previous registry intact", async () => {
      // openai constructor explodes; anthropic would otherwise swap to k2.
      ProviderFactory.register(
        "openai",
        class {
          constructor() {
            throw new Error("bad provider config");
          }
        } as unknown as new (config: unknown) => LLMProvider
      );
      const load = vi
        .fn()
        .mockResolvedValueOnce({ anthropic: { apiKey: "k1" } } as ProviderConfig)
        .mockResolvedValue({
          anthropic: { apiKey: "k2" },
          openai: { apiKey: "boom" },
        } as ProviderConfig);
      const onSourceError = vi.fn();
      const gateway = new LLMGateway({ source: { load }, refreshTtlMs: 1_000, onSourceError });

      await gateway.chat(createTestRequest());
      const original = instances.anthropic[0]!;

      vi.advanceTimersByTime(1_000);
      await expect(gateway.chat(createTestRequest())).resolves.toBeDefined();

      // Previous registry still serves; the half-built swap was rolled back.
      expect(onSourceError).toHaveBeenCalledTimes(1);
      expect(gateway.getProviderNames()).toEqual(["anthropic"]);
      expect(original.chatCompletion).toHaveBeenCalledTimes(2);
      // The instance built for the aborted swap was cleaned up, never used.
      const abandoned = instances.anthropic[1];
      if (abandoned) {
        expect(abandoned.chatCompletion).not.toHaveBeenCalled();
        expect(abandoned.dispose).toHaveBeenCalledTimes(1);
      }
    });

    it("ignores a refresh that completes after dispose", async () => {
      let resolveLoad!: (config: ProviderConfig) => void;
      const load = vi.fn(
        () =>
          new Promise<ProviderConfig>((resolve) => {
            resolveLoad = resolve;
          })
      );
      const gateway = new LLMGateway({ source: { load } });

      const pending = gateway.chat(createTestRequest());
      pending.catch(() => undefined); // inspected below; avoid unhandled rejection
      await gateway.dispose();
      resolveLoad({ anthropic: { apiKey: "k1" } });

      await expect(pending).rejects.toThrow();
      expect(gateway.getProviderNames()).toEqual([]);
      expect(instances.anthropic).toHaveLength(0);
    });

    it("falls back to the default TTL when refreshTtlMs is not finite", async () => {
      const load = vi.fn().mockResolvedValue({ anthropic: { apiKey: "k1" } } as ProviderConfig);
      const gateway = new LLMGateway({ source: { load }, refreshTtlMs: Number.NaN });

      await gateway.chat(createTestRequest());
      await gateway.chat(createTestRequest());
      expect(load).toHaveBeenCalledTimes(1);
    });

    it("rejects the first request with a clear error when the initial load fails", async () => {
      const load = vi.fn().mockRejectedValue(new Error("db down"));
      const gateway = new LLMGateway({ source: { load } });

      const failing = gateway.chat(createTestRequest());
      await expect(failing).rejects.toBeInstanceOf(LLMError);
      await expect(failing).rejects.toThrow(/provider configuration/i);

      // Recovery: the next request retries the load instead of caching failure.
      load.mockResolvedValue({ anthropic: { apiKey: "k1" } } as ProviderConfig);
      await expect(gateway.chat(createTestRequest())).resolves.toBeDefined();
      expect(load).toHaveBeenCalledTimes(2);
    });

    it("keeps serving the last good config when a refresh fails", async () => {
      const error = new Error("db down");
      const load = vi
        .fn()
        .mockResolvedValueOnce({ anthropic: { apiKey: "k1" } } as ProviderConfig)
        .mockRejectedValue(error);
      const onSourceError = vi.fn();
      const gateway = new LLMGateway({ source: { load }, refreshTtlMs: 1_000, onSourceError });

      await gateway.chat(createTestRequest());

      vi.advanceTimersByTime(1_000);
      await expect(gateway.chat(createTestRequest())).resolves.toBeDefined();
      expect(onSourceError).toHaveBeenCalledTimes(1);
      expect(onSourceError).toHaveBeenCalledWith(error);

      // Failed refresh stamps the TTL window: no reload until it lapses again.
      await gateway.chat(createTestRequest());
      expect(load).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(1_000);
      await gateway.chat(createTestRequest());
      expect(load).toHaveBeenCalledTimes(3);
    });
  });

  describe("dispose", () => {
    it("flushes pending deferred disposals and clears their timers", async () => {
      const load = vi
        .fn()
        .mockResolvedValueOnce({ anthropic: { apiKey: "k1" } } as ProviderConfig)
        .mockResolvedValue({ anthropic: { apiKey: "k2" } } as ProviderConfig);
      const gateway = new LLMGateway({
        source: { load },
        refreshTtlMs: 1_000,
        streamIdleTimeoutMs: 60_000,
      });

      await gateway.chat(createTestRequest());
      vi.advanceTimersByTime(1_000);
      await gateway.chat(createTestRequest());

      const [first, second] = [instances.anthropic[0]!, instances.anthropic[1]!];
      expect(first.dispose).not.toHaveBeenCalled();

      await gateway.dispose();
      expect(first.dispose).toHaveBeenCalledTimes(1);
      expect(second.dispose).toHaveBeenCalledTimes(1);
      expect(gateway.getProviderNames()).toEqual([]);

      // The deferred timer was cleared: no double dispose.
      vi.advanceTimersByTime(60_000);
      expect(first.dispose).toHaveBeenCalledTimes(1);
    });
  });
});
