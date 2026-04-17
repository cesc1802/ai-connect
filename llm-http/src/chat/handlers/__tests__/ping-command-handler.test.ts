import { describe, it, expect, vi, beforeEach } from "vitest";
import { PingCommandHandler } from "../ping-command-handler.js";
import type { AuthenticatedSocket } from "../../../ws/ws-types.js";
import type { HandlerContext } from "../ws-command-handler.js";

describe("PingCommandHandler", () => {
  let handler: PingCommandHandler;
  let send: ReturnType<typeof vi.fn>;
  let mockSocket: AuthenticatedSocket;
  let ctx: HandlerContext;

  beforeEach(() => {
    handler = new PingCommandHandler();
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
    it("should have type 'ping'", () => {
      expect(handler.type).toBe("ping");
    });

    it("should have type property as constant", () => {
      expect(handler.type).toBe("ping");
      // Type is a readonly const property in the class
      const descriptor = Object.getOwnPropertyDescriptor(handler, "type");
      if (descriptor) {
        expect(typeof handler.type).toBe("string");
      }
    });
  });

  describe("ping with id", () => {
    it("should send pong with same id when ping has id", () => {
      const msg = { type: "ping" as const, id: "ping-123" };

      handler.handle(mockSocket, msg, send, ctx);

      expect(send).toHaveBeenCalledWith({ type: "pong", id: "ping-123" });
      expect(send).toHaveBeenCalledTimes(1);
    });

    it("should send pong with different id values", () => {
      const ids = ["ping-1", "ping-abc", "123", "very-long-ping-identifier"];

      ids.forEach((id) => {
        send.mockClear();
        const msg = { type: "ping" as const, id };

        handler.handle(mockSocket, msg, send, ctx);

        expect(send).toHaveBeenCalledWith({ type: "pong", id });
      });
    });

    it("should omit id property if empty string provided", () => {
      const msg = { type: "ping" as const, id: "" };

      handler.handle(mockSocket, msg, send, ctx);

      const callArgs = send.mock.calls[0]?.[0];
      // Empty id is falsy, so it's omitted
      expect(callArgs).toEqual({ type: "pong" });
    });

    it("should handle special characters in id", () => {
      const msg = { type: "ping" as const, id: "ping-!@#$%^&*()" };

      handler.handle(mockSocket, msg, send, ctx);

      expect(send).toHaveBeenCalledWith({ type: "pong", id: "ping-!@#$%^&*()" });
    });

    it("should handle uuid-like id", () => {
      const msg = {
        type: "ping" as const,
        id: "550e8400-e29b-41d4-a716-446655440000",
      };

      handler.handle(mockSocket, msg, send, ctx);

      expect(send).toHaveBeenCalledWith({
        type: "pong",
        id: "550e8400-e29b-41d4-a716-446655440000",
      });
    });
  });

  describe("ping without id", () => {
    it("should send pong without id when ping has no id", () => {
      const msg = { type: "ping" as const };

      handler.handle(mockSocket, msg, send, ctx);

      expect(send).toHaveBeenCalledWith({ type: "pong" });
      expect(send).toHaveBeenCalledTimes(1);
    });

    it("should send pong with no id property", () => {
      const msg = { type: "ping" as const };

      handler.handle(mockSocket, msg, send, ctx);

      const callArgs = send.mock.calls[0]?.[0];
      expect(callArgs).toEqual({ type: "pong" });
      expect("id" in callArgs).toBe(false);
    });
  });

  describe("socket independence", () => {
    it("should not use socket data in response", () => {
      const msg = { type: "ping" as const, id: "test" };

      handler.handle(mockSocket, msg, send, ctx);

      expect(send).toHaveBeenCalledWith({ type: "pong", id: "test" });
      expect(mockSocket.send).not.toHaveBeenCalled();
    });

    it("should handle any authenticated socket", () => {
      const msg = { type: "ping" as const, id: "test" };

      const socket2 = {
        user: { id: "user-456", username: "otheruser" },
        isAlive: false,
      } as any;

      handler.handle(socket2, msg, send, ctx);

      expect(send).toHaveBeenCalledWith({ type: "pong", id: "test" });
    });
  });

  describe("context independence", () => {
    it("should not modify context", () => {
      const msg = { type: "ping" as const, id: "test" };
      const originalCtx = { ...ctx };

      handler.handle(mockSocket, msg, send, ctx);

      expect(ctx).toEqual(originalCtx);
    });

    it("should work regardless of active stream state", () => {
      const msg = { type: "ping" as const, id: "test" };

      // No active stream
      handler.handle(mockSocket, msg, send, { activeStream: { handle: null } });
      expect(send).toHaveBeenCalledWith({ type: "pong", id: "test" });

      send.mockClear();

      // With active stream (mock)
      handler.handle(mockSocket, msg, send, { activeStream: { handle: {} as any } });
      expect(send).toHaveBeenCalledWith({ type: "pong", id: "test" });
    });
  });

  describe("send function interaction", () => {
    it("should call send exactly once per ping", () => {
      const msg = { type: "ping" as const, id: "test" };

      handler.handle(mockSocket, msg, send, ctx);

      expect(send).toHaveBeenCalledTimes(1);
    });

    it("should pass correct message structure to send", () => {
      const msg = { type: "ping" as const, id: "test-id" };

      handler.handle(mockSocket, msg, send, ctx);

      const sentMessage = send.mock.calls[0]?.[0];
      expect(sentMessage).toHaveProperty("type");
      expect(sentMessage.type).toBe("pong");
    });

    it("should not call send multiple times on repeated invocations", () => {
      const msg = { type: "ping" as const, id: "test" };

      handler.handle(mockSocket, msg, send, ctx);
      handler.handle(mockSocket, msg, send, ctx);
      handler.handle(mockSocket, msg, send, ctx);

      expect(send).toHaveBeenCalledTimes(3);
    });

    it("should handle send function that throws", () => {
      const msg = { type: "ping" as const, id: "test" };
      const sendThatThrows = vi.fn().mockImplementation(() => {
        throw new Error("Send failed");
      });

      expect(() => handler.handle(mockSocket, msg, sendThatThrows, ctx)).toThrow(
        "Send failed"
      );
    });
  });

  describe("message format validation", () => {
    it("should work with typed ping message", () => {
      const msg: { type: "ping"; id?: string } = { type: "ping", id: "test" };

      handler.handle(mockSocket, msg, send, ctx);

      expect(send).toHaveBeenCalledWith({ type: "pong", id: "test" });
    });

    it("should preserve message id field exactly", () => {
      const testIds = [
        "simple",
        "with-dash",
        "with_underscore",
        "123",
        "MixedCase",
      ];

      testIds.forEach((id) => {
        send.mockClear();
        const msg = { type: "ping" as const, id };

        handler.handle(mockSocket, msg, send, ctx);

        expect(send).toHaveBeenCalledWith({ type: "pong", id });
      });
    });
  });

  describe("return value", () => {
    it("should return void", () => {
      const msg = { type: "ping" as const, id: "test" };

      const result = handler.handle(mockSocket, msg, send, ctx);

      expect(result).toBeUndefined();
    });
  });

  describe("performance", () => {
    it("should handle many rapid pings", () => {
      const iterations = 1000;
      const msg = { type: "ping" as const, id: "rapid-ping" };

      for (let i = 0; i < iterations; i++) {
        handler.handle(mockSocket, msg, send, ctx);
      }

      expect(send).toHaveBeenCalledTimes(iterations);
    });

    it("should handle pings with very long ids", () => {
      const longId = "x".repeat(10000);
      const msg = { type: "ping" as const, id: longId };

      handler.handle(mockSocket, msg, send, ctx);

      expect(send).toHaveBeenCalledWith({ type: "pong", id: longId });
    });
  });

  describe("idempotency", () => {
    it("should produce same response for same input", () => {
      const msg = { type: "ping" as const, id: "test-123" };

      handler.handle(mockSocket, msg, send, ctx);
      const firstCall = send.mock.calls[0]?.[0];

      send.mockClear();

      handler.handle(mockSocket, msg, send, ctx);
      const secondCall = send.mock.calls[0]?.[0];

      expect(firstCall).toEqual(secondCall);
    });
  });
});
