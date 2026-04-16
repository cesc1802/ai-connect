import { describe, it, expect, vi, beforeEach } from "vitest";
import { RetryDecorator } from "../retry-decorator.js";
import type { RetryEvent } from "../retry-decorator.js";
import type { LLMProvider } from "../../providers/index.js";
import type { ChatRequest, ChatResponse, StreamChunk, ProviderCapabilities } from "../../core/index.js";
import { LLMError, TimeoutError, RateLimitError } from "../../core/index.js";

function createMockProvider(): LLMProvider {
  return {
    name: "anthropic",
    models: ["claude-3-opus"],
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

function createTestResponse(): ChatResponse {
  return {
    id: "test-id",
    content: "Hello!",
    toolCalls: [],
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    model: "claude-3-opus",
    finishReason: "stop",
    latencyMs: 100,
  };
}

async function* createMockStream(): AsyncIterable<StreamChunk> {
  yield { id: "1", delta: { type: "text", text: "Hello" } };
  yield { id: "1", delta: { type: "text", text: "!" }, finishReason: "stop" };
}

describe("RetryDecorator", () => {
  let mockProvider: LLMProvider;
  let retryDecorator: RetryDecorator;

  beforeEach(() => {
    mockProvider = createMockProvider();
    retryDecorator = new RetryDecorator(mockProvider, {
      maxRetries: 3,
      initialDelayMs: 10,
      maxDelayMs: 100,
      backoffMultiplier: 2,
      retryableErrors: ["TIMEOUT", "RATE_LIMIT", "PROVIDER_ERROR"],
    });
  });

  describe("delegation", () => {
    it("delegates capabilities to underlying provider", () => {
      const caps = retryDecorator.capabilities();
      expect(mockProvider.capabilities).toHaveBeenCalled();
      expect(caps.streaming).toBe(true);
    });

    it("delegates supportsModel to underlying provider", () => {
      retryDecorator.supportsModel("claude-3-opus");
      expect(mockProvider.supportsModel).toHaveBeenCalledWith("claude-3-opus");
    });

    it("delegates dispose to underlying provider", async () => {
      await retryDecorator.dispose();
      expect(mockProvider.dispose).toHaveBeenCalled();
    });
  });

  describe("chatCompletion", () => {
    it("succeeds without retry", async () => {
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(createTestResponse());

      const response = await retryDecorator.chatCompletion(createTestRequest());

      expect(response.content).toBe("Hello!");
      expect(mockProvider.chatCompletion).toHaveBeenCalledTimes(1);
    });

    it("retries on retryable error", async () => {
      const timeoutError = new TimeoutError("anthropic", 5000);
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(timeoutError)
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValue(createTestResponse());

      const response = await retryDecorator.chatCompletion(createTestRequest());

      expect(response.content).toBe("Hello!");
      expect(mockProvider.chatCompletion).toHaveBeenCalledTimes(3);
    });

    it("retries on rate limit error", async () => {
      const rateLimitError = new RateLimitError("anthropic");
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue(createTestResponse());

      const response = await retryDecorator.chatCompletion(createTestRequest());

      expect(response.content).toBe("Hello!");
      expect(mockProvider.chatCompletion).toHaveBeenCalledTimes(2);
    });

    it("respects maxRetries", async () => {
      const timeoutError = new TimeoutError("anthropic", 5000);
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(timeoutError);

      await expect(retryDecorator.chatCompletion(createTestRequest())).rejects.toThrow(TimeoutError);
      // 1 initial + 3 retries = 4 calls
      expect(mockProvider.chatCompletion).toHaveBeenCalledTimes(4);
    });

    it("does not retry non-retryable errors", async () => {
      const validationError = new LLMError("Invalid request", "VALIDATION_ERROR");
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(validationError);

      await expect(retryDecorator.chatCompletion(createTestRequest())).rejects.toThrow(LLMError);
      expect(mockProvider.chatCompletion).toHaveBeenCalledTimes(1);
    });

    it("does not retry AbortError", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(abortError);

      await expect(retryDecorator.chatCompletion(createTestRequest())).rejects.toThrow();
      expect(mockProvider.chatCompletion).toHaveBeenCalledTimes(1);
    });

    it("retries on network errors", async () => {
      const networkError = new Error("ECONNRESET");
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue(createTestResponse());

      const response = await retryDecorator.chatCompletion(createTestRequest());

      expect(response.content).toBe("Hello!");
      expect(mockProvider.chatCompletion).toHaveBeenCalledTimes(2);
    });
  });

  describe("streamCompletion", () => {
    it("succeeds without retry", async () => {
      (mockProvider.streamCompletion as ReturnType<typeof vi.fn>).mockReturnValue(createMockStream());

      const chunks: StreamChunk[] = [];
      for await (const chunk of retryDecorator.streamCompletion(createTestRequest())) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(mockProvider.streamCompletion).toHaveBeenCalledTimes(1);
    });

    it("retries on stream error", async () => {
      async function* failingStream(): AsyncIterable<StreamChunk> {
        throw new TimeoutError("anthropic", 5000);
      }

      (mockProvider.streamCompletion as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(failingStream())
        .mockReturnValue(createMockStream());

      const chunks: StreamChunk[] = [];
      for await (const chunk of retryDecorator.streamCompletion(createTestRequest())) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(mockProvider.streamCompletion).toHaveBeenCalledTimes(2);
    });
  });

  describe("backoff calculation", () => {
    it("calculates exponential backoff", async () => {
      const delays: number[] = [];
      const decorator = new RetryDecorator(mockProvider, {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        retryableErrors: ["TIMEOUT"],
      });

      decorator.onRetry((event) => {
        if (event.willRetry) {
          delays.push(event.delayMs);
        }
      });

      const timeoutError = new TimeoutError("anthropic", 5000);
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(timeoutError);

      await expect(decorator.chatCompletion(createTestRequest())).rejects.toThrow();

      // Should have 3 retries with increasing delays
      expect(delays).toHaveLength(3);
      // Delays should be approximately 100, 200, 400 (with jitter)
      expect(delays[0]).toBeGreaterThanOrEqual(100);
      expect(delays[0]).toBeLessThanOrEqual(120); // 10% jitter
      expect(delays[1]).toBeGreaterThanOrEqual(200);
      expect(delays[1]).toBeLessThanOrEqual(240);
      expect(delays[2]).toBeGreaterThanOrEqual(400);
      expect(delays[2]).toBeLessThanOrEqual(480);
    });

    it("respects maxDelayMs", async () => {
      const delays: number[] = [];
      const decorator = new RetryDecorator(mockProvider, {
        maxRetries: 5,
        initialDelayMs: 100,
        maxDelayMs: 300,
        backoffMultiplier: 3,
        retryableErrors: ["TIMEOUT"],
      });

      decorator.onRetry((event) => {
        if (event.willRetry) {
          delays.push(event.delayMs);
        }
      });

      const timeoutError = new TimeoutError("anthropic", 5000);
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(timeoutError);

      await expect(decorator.chatCompletion(createTestRequest())).rejects.toThrow();

      // All delays should be capped at maxDelayMs
      for (const delay of delays) {
        expect(delay).toBeLessThanOrEqual(300);
      }
    });
  });

  describe("retry events", () => {
    it("emits retry events", async () => {
      const events: RetryEvent[] = [];
      retryDecorator.onRetry((event) => events.push(event));

      const timeoutError = new TimeoutError("anthropic", 5000);
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValue(createTestResponse());

      await retryDecorator.chatCompletion(createTestRequest());

      expect(events).toHaveLength(1);
      expect(events[0]!.attempt).toBe(1);
      expect(events[0]!.maxAttempts).toBe(4); // 1 + maxRetries
      expect(events[0]!.willRetry).toBe(true);
      expect(events[0]!.error).toBe(timeoutError);
    });

    it("emits final event with willRetry=false", async () => {
      const events: RetryEvent[] = [];
      retryDecorator.onRetry((event) => events.push(event));

      const timeoutError = new TimeoutError("anthropic", 5000);
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(timeoutError);

      await expect(retryDecorator.chatCompletion(createTestRequest())).rejects.toThrow();

      const lastEvent = events[events.length - 1]!;
      expect(lastEvent.willRetry).toBe(false);
      expect(lastEvent.attempt).toBe(4);
    });

    it("removes listeners with offRetry", async () => {
      const events: RetryEvent[] = [];
      const listener = (event: RetryEvent) => events.push(event);
      retryDecorator.onRetry(listener);
      retryDecorator.offRetry(listener);

      const timeoutError = new TimeoutError("anthropic", 5000);
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValue(createTestResponse());

      await retryDecorator.chatCompletion(createTestRequest());

      expect(events).toHaveLength(0);
    });

    it("ignores listener errors", async () => {
      retryDecorator.onRetry(() => {
        throw new Error("Listener error");
      });

      const timeoutError = new TimeoutError("anthropic", 5000);
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValue(createTestResponse());

      // Should not throw
      const response = await retryDecorator.chatCompletion(createTestRequest());
      expect(response.content).toBe("Hello!");
    });
  });

  describe("abort signal", () => {
    it("respects abort signal during sleep", async () => {
      const controller = new AbortController();
      const decorator = new RetryDecorator(mockProvider, {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
        retryableErrors: ["TIMEOUT"],
      });

      const timeoutError = new TimeoutError("anthropic", 5000);
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(timeoutError);

      const promise = decorator.chatCompletion(createTestRequest(), controller.signal);

      // Abort after a short delay
      setTimeout(() => controller.abort("User cancelled"), 50);

      await expect(promise).rejects.toThrow();
    });
  });
});
