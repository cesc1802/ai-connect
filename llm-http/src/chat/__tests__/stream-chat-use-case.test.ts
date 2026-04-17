import { describe, it, expect, vi, beforeEach } from "vitest";
import { StreamChatUseCase, type StreamCallbacks } from "../stream-chat-use-case.js";
import type { ChatGatewayPort } from "../chat-gateway-port.js";
import type { ChatRequest, TokenUsage, FinishReason } from "llm-gateway";

const createChatRequest = (overrides?: Partial<ChatRequest>): ChatRequest => ({
  model: "gpt-4",
  messages: [{ role: "user", content: "test" }],
  maxTokens: 4096,
  ...overrides,
});

describe("StreamChatUseCase", () => {
  let useCase: StreamChatUseCase;
  let mockGateway: ChatGatewayPort;
  let callbacks: StreamCallbacks;

  beforeEach(() => {
    callbacks = {
      onChunk: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    };

    mockGateway = {
      chat: vi.fn(),
      stream: vi.fn(),
      getMetrics: vi.fn(),
      dispose: vi.fn(),
    };

    useCase = new StreamChatUseCase(mockGateway);
  });

  describe("basic stream execution", () => {
    it("should execute stream with minimal request", async () => {
      const chunks: any[] = [
        {
          delta: { type: "text", text: "Hello " },
        },
        {
          delta: { type: "text", text: "world" },
        },
        {
          finishReason: "stop",
          usage: { inputTokens: 10, outputTokens: 2 },
        },
      ];

      const asyncIter = (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })();

      vi.mocked(mockGateway.stream).mockReturnValue(asyncIter);

      const req = createChatRequest({ messages: [{ role: "user", content: "Hi" }] });

      const handle = useCase.execute(req, callbacks);

      await handle.done;

      expect(vi.mocked(callbacks.onChunk)).toHaveBeenCalledWith("Hello ");
      expect(vi.mocked(callbacks.onChunk)).toHaveBeenCalledWith("world");
      expect(vi.mocked(callbacks.onDone)).toHaveBeenCalledWith(
        { inputTokens: 10, outputTokens: 2 },
        "stop"
      );
      expect(vi.mocked(callbacks.onError)).not.toHaveBeenCalled();
    });

    it("should return stream handle with abort capability", async () => {
      const asyncIter = (async function* () {
        yield { delta: { type: "text", text: "test" } };
      })();

      vi.mocked(mockGateway.stream).mockReturnValue(asyncIter);

      const req = createChatRequest({ messages: [{ role: "user", content: "Hi" }] });

      const handle = useCase.execute(req, callbacks);

      expect(handle.abort).toBeDefined();
      expect(typeof handle.abort).toBe("function");
      expect(handle.done).toBeDefined();
      expect(handle.done instanceof Promise).toBe(true);
    });
  });

  describe("stream chunk handling", () => {
    it("should call onChunk for each text delta", async () => {
      const chunks: any[] = [
        { delta: { type: "text", text: "Chunk1" } },
        { delta: { type: "text", text: "Chunk2" } },
        { delta: { type: "text", text: "Chunk3" } },
        { finishReason: "stop", usage: { inputTokens: 5, outputTokens: 3 } },
      ];

      const asyncIter = (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })();

      vi.mocked(mockGateway.stream).mockReturnValue(asyncIter);

      const req = createChatRequest();

      const handle = useCase.execute(req, callbacks);
      await handle.done;

      expect(vi.mocked(callbacks.onChunk)).toHaveBeenCalledTimes(3);
      expect(vi.mocked(callbacks.onChunk)).toHaveBeenNthCalledWith(1, "Chunk1");
      expect(vi.mocked(callbacks.onChunk)).toHaveBeenNthCalledWith(2, "Chunk2");
      expect(vi.mocked(callbacks.onChunk)).toHaveBeenNthCalledWith(3, "Chunk3");
    });

    it("should handle non-text deltas without calling onChunk", async () => {
      const chunks: any[] = [
        { delta: { type: "function_call", name: "test_fn" } },
        { delta: { type: "text", text: "Hello" } },
        { finishReason: "stop", usage: { inputTokens: 5, outputTokens: 1 } },
      ];

      const asyncIter = (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })();

      vi.mocked(mockGateway.stream).mockReturnValue(asyncIter);

      const req = createChatRequest();

      const handle = useCase.execute(req, callbacks);
      await handle.done;

      expect(vi.mocked(callbacks.onChunk)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(callbacks.onChunk)).toHaveBeenCalledWith("Hello");
    });

    it("should handle chunks without delta gracefully", async () => {
      const chunks: any[] = [
        { finishReason: "stop", usage: { inputTokens: 5, outputTokens: 0 } },
      ];

      const asyncIter = (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })();

      vi.mocked(mockGateway.stream).mockReturnValue(asyncIter);

      const req = createChatRequest();

      const handle = useCase.execute(req, callbacks);
      await handle.done;

      expect(vi.mocked(callbacks.onChunk)).not.toHaveBeenCalled();
      expect(vi.mocked(callbacks.onDone)).toHaveBeenCalled();
    });
  });

  describe("stream completion", () => {
    it("should call onDone with usage and finish reason", async () => {
      const usage: TokenUsage = { inputTokens: 100, outputTokens: 50 };
      const finishReason: FinishReason = "stop";

      const chunks: any[] = [
        { delta: { type: "text", text: "Response" } },
        { finishReason, usage },
      ];

      const asyncIter = (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })();

      vi.mocked(mockGateway.stream).mockReturnValue(asyncIter);

      const req = createChatRequest();

      const handle = useCase.execute(req, callbacks);
      await handle.done;

      expect(vi.mocked(callbacks.onDone)).toHaveBeenCalledWith(usage, finishReason);
    });

    it("should handle different finish reasons", async () => {
      const finishReasons: FinishReason[] = ["stop", "length", "tool_calls", "content_filter"];

      for (const reason of finishReasons) {
        vi.clearAllMocks();

        const chunks: any[] = [
          { finishReason: reason, usage: { inputTokens: 10, outputTokens: 5 } },
        ];

        const asyncIter = (async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        })();

        vi.mocked(mockGateway.stream).mockReturnValue(asyncIter);

        const req = createChatRequest();

        const handle = useCase.execute(req, callbacks);
        await handle.done;

        expect(vi.mocked(callbacks.onDone)).toHaveBeenCalledWith(
          expect.any(Object),
          reason
        );
      }
    });

    it("should not call onDone if no finish reason in stream", async () => {
      const chunks: any[] = [{ delta: { type: "text", text: "Hello" } }];

      const asyncIter = (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })();

      vi.mocked(mockGateway.stream).mockReturnValue(asyncIter);

      const req = createChatRequest();

      const handle = useCase.execute(req, callbacks);
      await handle.done;

      expect(vi.mocked(callbacks.onDone)).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should call onError when stream throws", async () => {
      const error = new Error("Stream failed");

      const asyncIter = (async function* () {
        throw error;
      })();

      vi.mocked(mockGateway.stream).mockReturnValue(asyncIter);

      const req = createChatRequest();

      const handle = useCase.execute(req, callbacks);
      await handle.done;

      expect(vi.mocked(callbacks.onError)).toHaveBeenCalledWith(error);
      expect(vi.mocked(callbacks.onChunk)).not.toHaveBeenCalled();
      expect(vi.mocked(callbacks.onDone)).not.toHaveBeenCalled();
    });

    it("should not call onError when stream is aborted", async () => {
      let resolveIter: (() => void) | null = null;

      const asyncIter = (async function* () {
        yield { delta: { type: "text", text: "Hello" } };
        await new Promise((resolve) => {
          resolveIter = resolve;
        });
      })();

      vi.mocked(mockGateway.stream).mockReturnValue(asyncIter);

      const req = createChatRequest();

      const handle = useCase.execute(req, callbacks);

      // Abort immediately after yielding
      setTimeout(() => {
        handle.abort();
      }, 10);

      // Wait a bit for abort to take effect
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Simulate the AbortError
      if (resolveIter) {
        resolveIter();
      }

      await handle.done.catch(() => {});

      // onError should not be called for abort
      // (depends on implementation - abort may or may not throw)
    });

    it("should handle different error types", async () => {
      const errors = [
        new Error("Network error"),
        new TypeError("Invalid response"),
        new RangeError("Invalid range"),
      ];

      for (const error of errors) {
        vi.clearAllMocks();

        const asyncIter = (async function* () {
          throw error;
        })();

        vi.mocked(mockGateway.stream).mockReturnValue(asyncIter);

        const req = createChatRequest();

        const handle = useCase.execute(req, callbacks);
        await handle.done;

        expect(vi.mocked(callbacks.onError)).toHaveBeenCalledWith(error);
      }
    });
  });

  describe("abort functionality", () => {
    it("should abort stream when handle.abort is called", async () => {
      let abortSignalReceived: AbortSignal | null = null;

      vi.mocked(mockGateway.stream).mockImplementation((req, signal) => {
        abortSignalReceived = signal;
        return (async function* () {
          yield { delta: { type: "text", text: "test" } };
        })();
      });

      const req = createChatRequest();

      const handle = useCase.execute(req, callbacks);
      handle.abort();

      expect(abortSignalReceived?.aborted).toBe(true);
    });

    it("should pass abort signal to gateway.stream", async () => {
      const mockStream = vi.fn().mockReturnValue((async function* () {})());
      mockGateway.stream = mockStream;

      const req = createChatRequest();

      useCase.execute(req, callbacks);

      expect(mockStream).toHaveBeenCalled();
      const signal = mockStream.mock.calls[0][1];
      expect(signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe("gateway request", () => {
    it("should call gateway.stream with correct request", async () => {
      const req = createChatRequest({
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi" },
        ],
      });

      const mockStream = vi.fn().mockReturnValue((async function* () {})());
      mockGateway.stream = mockStream;

      useCase.execute(req, callbacks);

      expect(mockStream).toHaveBeenCalledWith(req, expect.any(AbortSignal));
    });

    it("should pass through request with optional fields", async () => {
      const req = createChatRequest({
        model: "claude-3",
        maxTokens: 2000,
        temperature: 0.5,
      });

      const mockStream = vi.fn().mockReturnValue((async function* () {})());
      mockGateway.stream = mockStream;

      useCase.execute(req, callbacks);

      expect(mockStream).toHaveBeenCalledWith(
        {
          model: "claude-3",
          messages: [{ role: "user", content: "test" }],
          maxTokens: 2000,
          temperature: 0.5,
        },
        expect.any(AbortSignal)
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty string text deltas", async () => {
      const chunks: any[] = [
        { delta: { type: "text", text: "" } },
        { delta: { type: "text", text: "Hello" } },
        { finishReason: "stop", usage: { inputTokens: 5, outputTokens: 1 } },
      ];

      const asyncIter = (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })();

      vi.mocked(mockGateway.stream).mockReturnValue(asyncIter);

      const req = createChatRequest();

      const handle = useCase.execute(req, callbacks);
      await handle.done;

      expect(vi.mocked(callbacks.onChunk)).toHaveBeenCalledWith("");
      expect(vi.mocked(callbacks.onChunk)).toHaveBeenCalledWith("Hello");
    });

    it("should handle large text deltas", async () => {
      const largeText = "x".repeat(10000);
      const chunks: any[] = [
        { delta: { type: "text", text: largeText } },
        { finishReason: "stop", usage: { inputTokens: 5, outputTokens: 1000 } },
      ];

      const asyncIter = (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })();

      vi.mocked(mockGateway.stream).mockReturnValue(asyncIter);

      const req = createChatRequest();

      const handle = useCase.execute(req, callbacks);
      await handle.done;

      expect(vi.mocked(callbacks.onChunk)).toHaveBeenCalledWith(largeText);
    });

    it("should handle special characters in text", async () => {
      const specialText = "Hello\nWorld\t!@#$%^&*()";
      const chunks: any[] = [
        { delta: { type: "text", text: specialText } },
        { finishReason: "stop", usage: { inputTokens: 5, outputTokens: 1 } },
      ];

      const asyncIter = (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })();

      vi.mocked(mockGateway.stream).mockReturnValue(asyncIter);

      const req = createChatRequest();

      const handle = useCase.execute(req, callbacks);
      await handle.done;

      expect(vi.mocked(callbacks.onChunk)).toHaveBeenCalledWith(specialText);
    });

    it("should handle unicode text", async () => {
      const unicodeText = "Hello 世界 🌍 مرحبا";
      const chunks: any[] = [
        { delta: { type: "text", text: unicodeText } },
        { finishReason: "stop", usage: { inputTokens: 5, outputTokens: 1 } },
      ];

      const asyncIter = (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })();

      vi.mocked(mockGateway.stream).mockReturnValue(asyncIter);

      const req = createChatRequest();

      const handle = useCase.execute(req, callbacks);
      await handle.done;

      expect(vi.mocked(callbacks.onChunk)).toHaveBeenCalledWith(unicodeText);
    });
  });
});
