import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatCommandHandler } from "../chat-command-handler.js";
import type { StreamChatUseCase, StreamHandle } from "../../stream-chat-use-case.js";
import type { AuthenticatedSocket } from "../../../ws/ws-types.js";
import type { HandlerContext } from "../ws-command-handler.js";

describe("ChatCommandHandler", () => {
  let handler: ChatCommandHandler;
  let mockStreamChat: StreamChatUseCase;
  let send: ReturnType<typeof vi.fn>;
  let mockSocket: AuthenticatedSocket;
  let ctx: HandlerContext;
  let mockStreamHandle: StreamHandle;

  beforeEach(() => {
    mockStreamHandle = {
      abort: vi.fn(),
      done: Promise.resolve(),
    };

    mockStreamChat = {
      execute: vi.fn().mockReturnValue(mockStreamHandle),
    } as any;

    handler = new ChatCommandHandler(mockStreamChat);
    send = vi.fn();
    ctx = { activeStream: { handle: null } };

    mockSocket = {
      user: { id: "user-123", username: "testuser" },
      isAlive: true,
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as any;
  });

  describe("handler type", () => {
    it("should have type 'chat'", () => {
      expect(handler.type).toBe("chat");
    });
  });

  describe("basic chat execution", () => {
    it("should execute stream with basic chat message", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "Hello" }],
      };

      handler.handle(mockSocket, msg, send, ctx);

      expect(vi.mocked(mockStreamChat.execute)).toHaveBeenCalled();
      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      expect(call).toBeDefined();
      expect(call![0].model).toBe("gpt-4");
      expect(call![0].messages).toEqual([{ role: "user", content: "Hello" }]);
    });

    it("should set maxTokens to default when not provided", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      expect(call).toBeDefined();
      expect(call![0].maxTokens).toBe(4096);
    });

    it("should use provided maxTokens", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
        maxTokens: 2000,
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      expect(call).toBeDefined();
      expect(call![0].maxTokens).toBe(2000);
    });

    it("should not include temperature when not provided", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      expect(call).toBeDefined();
      expect("temperature" in call![0]).toBe(false);
    });

    it("should include temperature when provided", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
        temperature: 0.7,
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      expect(call).toBeDefined();
      expect(call![0].temperature).toBe(0.7);
    });

    it("should include temperature even when zero", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
        temperature: 0,
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      expect(call).toBeDefined();
      expect("temperature" in call![0]).toBe(true);
      expect(call![0].temperature).toBe(0);
    });
  });

  describe("stream handle management", () => {
    it("should store stream handle in context", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      expect(ctx.activeStream.handle).toBe(null);

      handler.handle(mockSocket, msg, send, ctx);

      expect(ctx.activeStream.handle).toBe(mockStreamHandle);
    });

    it("should abort previous stream when new chat starts", () => {
      const previousHandle: StreamHandle = {
        abort: vi.fn(),
        done: Promise.resolve(),
      };
      ctx.activeStream.handle = previousHandle;

      const msg = {
        type: "chat" as const,
        id: "chat-456",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "new message" }],
      };

      handler.handle(mockSocket, msg, send, ctx);

      expect(previousHandle.abort).toHaveBeenCalled();
    });

    it("should handle null previous stream handle gracefully", () => {
      ctx.activeStream.handle = null;

      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      expect(() => handler.handle(mockSocket, msg, send, ctx)).not.toThrow();
    });
  });

  describe("callback handling", () => {
    it("should register callbacks with stream", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      expect(call).toBeDefined();
      const callbacks = call![1];
      expect(callbacks.onChunk).toBeDefined();
      expect(callbacks.onDone).toBeDefined();
      expect(callbacks.onError).toBeDefined();
    });

    it("should call send with chunk message on onChunk", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      const callbacks = call![1];
      callbacks.onChunk("Hello ");

      expect(send).toHaveBeenCalledWith({
        type: "chunk",
        id: "chat-123",
        delta: "Hello ",
      });
    });

    it("should call send with done message on onDone", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-456",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      const callbacks = call![1];
      const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
      const finishReason = "stop";

      callbacks.onDone(usage, finishReason);

      expect(send).toHaveBeenCalledWith({
        type: "done",
        id: "chat-456",
        usage,
        finishReason,
      });
    });

    it("should clear stream handle on onDone", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      handler.handle(mockSocket, msg, send, ctx);
      expect(ctx.activeStream.handle).not.toBe(null);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      const callbacks = call![1];
      callbacks.onDone({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }, "stop");

      expect(ctx.activeStream.handle).toBe(null);
    });

    it("should call send with error message on onError", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-789",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      const callbacks = call![1];
      const error = new Error("Provider error");
      error.name = "AuthenticationError";

      callbacks.onError(error);

      expect(send).toHaveBeenCalledWith({
        type: "error",
        id: "chat-789",
        code: "provider_auth_error",
        message: "Provider error",
      });
    });

    it("should clear stream handle on onError", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      handler.handle(mockSocket, msg, send, ctx);
      expect(ctx.activeStream.handle).not.toBe(null);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      const callbacks = call![1];
      const error = new Error("Stream error");
      callbacks.onError(error);

      expect(ctx.activeStream.handle).toBe(null);
    });
  });

  describe("error mapping", () => {
    it("should map AuthenticationError to provider_auth_error", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      const callbacks = call![1];
      const error = new Error("Invalid API key");
      error.name = "AuthenticationError";

      callbacks.onError(error);

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          code: "provider_auth_error",
        })
      );
    });

    it("should map RateLimitError to provider_rate_limit", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      const callbacks = call![1];
      const error = new Error("Rate limit exceeded");
      error.name = "RateLimitError";

      callbacks.onError(error);

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "provider_rate_limit",
        })
      );
    });

    it("should map TimeoutError to provider_timeout", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      const callbacks = call![1];
      const error = new Error("Timeout");
      error.name = "TimeoutError";

      callbacks.onError(error);

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "provider_timeout",
        })
      );
    });

    it("should map unknown error to internal_error", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      const callbacks = call![1];
      const error = new Error("Unknown error");

      callbacks.onError(error);

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "internal_error",
        })
      );
    });
  });

  describe("message request construction", () => {
    it("should pass all required fields", () => {
      const msg = {
        type: "chat" as const,
        id: "conv-1",
        model: "claude-3",
        messages: [
          { role: "user" as const, content: "Hello" },
          { role: "assistant" as const, content: "Hi" },
        ],
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      expect(call).toBeDefined();
      expect(call![0]).toMatchObject({
        model: "claude-3",
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi" },
        ],
        maxTokens: 4096,
      });
    });

    it("should not mutate original message", () => {
      const original = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
        temperature: 0.5,
      };

      const copy = JSON.parse(JSON.stringify(original));

      handler.handle(mockSocket, original, send, ctx);

      expect(original).toEqual(copy);
    });

    it("should handle multiple messages in conversation", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [
          { role: "user" as const, content: "First" },
          { role: "assistant" as const, content: "Response" },
          { role: "user" as const, content: "Second" },
          { role: "assistant" as const, content: "Another" },
        ],
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      expect(call).toBeDefined();
      expect(call![0].messages).toHaveLength(4);
    });
  });

  describe("message id tracking", () => {
    it("should pass correct id in chunk message", () => {
      const msg = {
        type: "chat" as const,
        id: "unique-id-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      const callbacks = call![1];
      callbacks.onChunk("text");

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "unique-id-123",
        })
      );
    });

    it("should pass correct id in done message", () => {
      const msg = {
        type: "chat" as const,
        id: "another-id-456",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      const callbacks = call![1];
      callbacks.onDone({ inputTokens: 5, outputTokens: 10 }, "stop");

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "another-id-456",
        })
      );
    });

    it("should pass correct id in error message", () => {
      const msg = {
        type: "chat" as const,
        id: "error-id-789",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      const callbacks = call![1];
      callbacks.onError(new Error("test error"));

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "error-id-789",
        })
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty message content", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "" }],
      };

      expect(() => handler.handle(mockSocket, msg, send, ctx)).not.toThrow();
    });

    it("should handle very long maxTokens", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
        maxTokens: 100000,
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      expect(call).toBeDefined();
      expect(call![0].maxTokens).toBe(100000);
    });

    it("should handle system messages", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [
          { role: "system" as const, content: "You are helpful" },
          { role: "user" as const, content: "test" },
        ],
      };

      handler.handle(mockSocket, msg, send, ctx);

      const call = vi.mocked(mockStreamChat.execute).mock.calls[0];
      expect(call).toBeDefined();
      expect(call![0].messages[0].role).toBe("system");
    });

    it("should handle rapid successive chats and abort previous", () => {
      const msg1 = {
        type: "chat" as const,
        id: "chat-1",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "first" }],
      };

      const msg2 = {
        type: "chat" as const,
        id: "chat-2",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "second" }],
      };

      handler.handle(mockSocket, msg1, send, ctx);
      const handle1 = ctx.activeStream.handle as StreamHandle;

      // Verify first handle is stored
      expect(handle1).toBeDefined();
      expect(handle1.abort).toBeDefined();

      handler.handle(mockSocket, msg2, send, ctx);
      const handle2 = ctx.activeStream.handle;

      // Verify previous handle was aborted
      expect(vi.mocked(handle1.abort)).toHaveBeenCalled();
      expect(handle2).toBeDefined();
    });
  });

  describe("return value", () => {
    it("should return void", () => {
      const msg = {
        type: "chat" as const,
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" as const, content: "test" }],
      };

      const result = handler.handle(mockSocket, msg, send, ctx);

      expect(result).toBeUndefined();
    });
  });
});
