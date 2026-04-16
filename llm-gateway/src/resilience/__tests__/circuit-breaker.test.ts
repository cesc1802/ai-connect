import { describe, it, expect, vi, beforeEach } from "vitest";
import { CircuitBreaker, CircuitState } from "../circuit-breaker.js";
import type { LLMProvider } from "../../providers/index.js";
import type { ChatRequest, ChatResponse, StreamChunk, ProviderCapabilities } from "../../core/index.js";
import { CircuitOpenError } from "../../core/index.js";

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
  yield { id: "1", delta: { type: "text", text: " world" }, finishReason: "stop" };
}

describe("CircuitBreaker", () => {
  let mockProvider: LLMProvider;
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    mockProvider = createMockProvider();
    circuitBreaker = new CircuitBreaker(mockProvider, {
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenRequests: 2,
    });
  });

  describe("delegation", () => {
    it("delegates capabilities to underlying provider", () => {
      const caps = circuitBreaker.capabilities();
      expect(mockProvider.capabilities).toHaveBeenCalled();
      expect(caps.streaming).toBe(true);
    });

    it("delegates supportsModel to underlying provider", () => {
      circuitBreaker.supportsModel("claude-3-opus");
      expect(mockProvider.supportsModel).toHaveBeenCalledWith("claude-3-opus");
    });

    it("delegates dispose to underlying provider", async () => {
      await circuitBreaker.dispose();
      expect(mockProvider.dispose).toHaveBeenCalled();
    });
  });

  describe("closed state", () => {
    it("starts in closed state", () => {
      expect(circuitBreaker.getMetrics().state).toBe(CircuitState.CLOSED);
    });

    it("passes requests through when closed", async () => {
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(createTestResponse());

      const response = await circuitBreaker.chatCompletion(createTestRequest());
      expect(response.content).toBe("Hello!");
      expect(mockProvider.chatCompletion).toHaveBeenCalled();
    });

    it("records successes", async () => {
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(createTestResponse());

      await circuitBreaker.chatCompletion(createTestRequest());
      expect(circuitBreaker.getMetrics().successes).toBe(1);
      expect(circuitBreaker.getMetrics().lastSuccess).toBeDefined();
    });

    it("records failures", async () => {
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("fail"));

      await expect(circuitBreaker.chatCompletion(createTestRequest())).rejects.toThrow("fail");
      expect(circuitBreaker.getMetrics().failures).toBe(1);
      expect(circuitBreaker.getMetrics().lastFailure).toBeDefined();
    });
  });

  describe("open state", () => {
    it("opens after failure threshold", async () => {
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("fail"));

      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.chatCompletion(createTestRequest())).rejects.toThrow();
      }

      expect(circuitBreaker.getMetrics().state).toBe(CircuitState.OPEN);
      expect(circuitBreaker.getMetrics().openedAt).toBeDefined();
    });

    it("rejects requests when open", async () => {
      circuitBreaker.forceOpen();

      await expect(circuitBreaker.chatCompletion(createTestRequest())).rejects.toThrow(CircuitOpenError);
      expect(mockProvider.chatCompletion).not.toHaveBeenCalled();
    });

    it("rejects streaming when open", async () => {
      circuitBreaker.forceOpen();

      const stream = circuitBreaker.streamCompletion(createTestRequest());
      await expect(async () => {
        for await (const _chunk of stream) {
          // Should throw before yielding
        }
      }).rejects.toThrow(CircuitOpenError);
    });
  });

  describe("half-open state", () => {
    it("transitions to half-open after timeout", async () => {
      const cb = new CircuitBreaker(mockProvider, {
        failureThreshold: 1,
        resetTimeoutMs: 10,
        halfOpenRequests: 2,
      });

      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fail"));
      await expect(cb.chatCompletion(createTestRequest())).rejects.toThrow();
      expect(cb.getMetrics().state).toBe(CircuitState.OPEN);

      // Wait for timeout
      await new Promise((r) => setTimeout(r, 20));

      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(createTestResponse());
      await cb.chatCompletion(createTestRequest());

      expect(cb.getMetrics().state).toBe(CircuitState.CLOSED);
    });

    it("allows limited requests in half-open before hitting limit", async () => {
      const cb = new CircuitBreaker(mockProvider, {
        failureThreshold: 1,
        resetTimeoutMs: 10,
        halfOpenRequests: 2,
      });

      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fail"));
      await expect(cb.chatCompletion(createTestRequest())).rejects.toThrow();

      await new Promise((r) => setTimeout(r, 20));

      // First request in half-open fails - circuit should reopen immediately
      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fail1"));
      await expect(cb.chatCompletion(createTestRequest())).rejects.toThrow("fail1");

      // Circuit should now be open again
      expect(cb.getMetrics().state).toBe(CircuitState.OPEN);

      // Subsequent request should be rejected with CircuitOpenError
      await expect(cb.chatCompletion(createTestRequest())).rejects.toThrow(CircuitOpenError);
    });

    it("closes on success in half-open", async () => {
      const cb = new CircuitBreaker(mockProvider, {
        failureThreshold: 1,
        resetTimeoutMs: 10,
        halfOpenRequests: 2,
      });

      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fail"));
      await expect(cb.chatCompletion(createTestRequest())).rejects.toThrow();

      await new Promise((r) => setTimeout(r, 20));

      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(createTestResponse());
      await cb.chatCompletion(createTestRequest());

      expect(cb.getMetrics().state).toBe(CircuitState.CLOSED);
      expect(cb.getMetrics().failures).toBe(0);
    });

    it("reopens on failure in half-open", async () => {
      const cb = new CircuitBreaker(mockProvider, {
        failureThreshold: 1,
        resetTimeoutMs: 10,
        halfOpenRequests: 2,
      });

      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fail"));
      await expect(cb.chatCompletion(createTestRequest())).rejects.toThrow();

      await new Promise((r) => setTimeout(r, 20));

      (mockProvider.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fail again"));
      await expect(cb.chatCompletion(createTestRequest())).rejects.toThrow("fail again");

      expect(cb.getMetrics().state).toBe(CircuitState.OPEN);
    });
  });

  describe("streaming", () => {
    it("passes streaming through when closed", async () => {
      (mockProvider.streamCompletion as ReturnType<typeof vi.fn>).mockReturnValue(createMockStream());

      const chunks: StreamChunk[] = [];
      for await (const chunk of circuitBreaker.streamCompletion(createTestRequest())) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(circuitBreaker.getMetrics().successes).toBe(1);
    });

    it("records failure on stream error", async () => {
      async function* failingStream(): AsyncIterable<StreamChunk> {
        yield { id: "1", delta: { type: "text", text: "Hi" } };
        throw new Error("stream failed");
      }
      (mockProvider.streamCompletion as ReturnType<typeof vi.fn>).mockReturnValue(failingStream());

      const stream = circuitBreaker.streamCompletion(createTestRequest());
      await expect(async () => {
        for await (const _chunk of stream) {
          // Consume
        }
      }).rejects.toThrow("stream failed");

      expect(circuitBreaker.getMetrics().failures).toBe(1);
    });
  });

  describe("force methods", () => {
    it("forceOpen opens the circuit", () => {
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getMetrics().state).toBe(CircuitState.OPEN);
      expect(circuitBreaker.getMetrics().openedAt).toBeDefined();
    });

    it("forceClosed closes the circuit", () => {
      circuitBreaker.forceOpen();
      circuitBreaker.forceClosed();
      expect(circuitBreaker.getMetrics().state).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getMetrics().failures).toBe(0);
    });
  });
});
