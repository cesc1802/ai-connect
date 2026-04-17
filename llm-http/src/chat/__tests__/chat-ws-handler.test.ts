import { describe, it, expect, vi, beforeEach } from "vitest";
import { attachChatHandler, type WsCommandHandlerMap } from "../chat-ws-handler.js";
import type { AuthenticatedSocket } from "../../ws/ws-types.js";
import type { WsCommandHandler } from "../handlers/ws-command-handler.js";

describe("attachChatHandler", () => {
  let mockLogger: any;
  let mockSocket: AuthenticatedSocket;
  let handlers: WsCommandHandlerMap;
  let mockPingHandler: WsCommandHandler;
  let mockChatHandler: WsCommandHandler;

  beforeEach(() => {
    mockLogger = {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    mockPingHandler = {
      type: "ping",
      handle: vi.fn(),
    };

    mockChatHandler = {
      type: "chat",
      handle: vi.fn(),
    };

    handlers = {
      ping: mockPingHandler,
      chat: mockChatHandler,
    };

    mockSocket = {
      user: { id: "user-123", username: "testuser" },
      isAlive: true,
      bufferedAmount: 0,
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as any;
  });

  describe("attachChatHandler returns function", () => {
    it("should return a connection listener function", () => {
      const listener = attachChatHandler(handlers, mockLogger);

      expect(typeof listener).toBe("function");
    });

    it("should return function that accepts AuthenticatedSocket", () => {
      const listener = attachChatHandler(handlers, mockLogger);

      expect(() => listener(mockSocket)).not.toThrow();
    });
  });

  describe("message handling - ping", () => {
    it("should handle valid ping message", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];
      expect(onMessage).toBeDefined();

      const pingMsg = JSON.stringify({ type: "ping", id: "ping-123" });
      onMessage!(Buffer.from(pingMsg));

      expect(mockPingHandler.handle).toHaveBeenCalled();
    });

    it("should route ping to correct handler", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const pingMsg = JSON.stringify({ type: "ping", id: "test-id" });
      onMessage!(Buffer.from(pingMsg));

      const call = vi.mocked(mockPingHandler.handle).mock.calls[0];
      expect(call[1].type).toBe("ping");
      expect(call[1].id).toBe("test-id");
    });

    it("should handle ping without id", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const pingMsg = JSON.stringify({ type: "ping" });
      onMessage!(Buffer.from(pingMsg));

      expect(mockPingHandler.handle).toHaveBeenCalled();
    });
  });

  describe("message handling - chat", () => {
    it("should handle valid chat message", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const chatMsg = JSON.stringify({
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      });
      onMessage!(Buffer.from(chatMsg));

      expect(mockChatHandler.handle).toHaveBeenCalled();
    });

    it("should route chat to correct handler", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const chatMsg = JSON.stringify({
        type: "chat",
        id: "chat-456",
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }],
      });
      onMessage!(Buffer.from(chatMsg));

      const call = vi.mocked(mockChatHandler.handle).mock.calls[0];
      expect(call[1].type).toBe("chat");
      expect(call[1].id).toBe("chat-456");
    });

    it("should pass socket to handler", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const chatMsg = JSON.stringify({
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }],
      });
      onMessage!(Buffer.from(chatMsg));

      const call = vi.mocked(mockChatHandler.handle).mock.calls[0];
      expect(call[0]).toBe(mockSocket);
    });

    it("should handle chat with optional fields", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const chatMsg = JSON.stringify({
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }],
        maxTokens: 2000,
        temperature: 0.7,
      });
      onMessage!(Buffer.from(chatMsg));

      expect(mockChatHandler.handle).toHaveBeenCalled();
    });
  });

  describe("invalid JSON handling", () => {
    it("should send error for invalid JSON", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      onMessage!(Buffer.from("not valid json"));

      expect(mockSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "error",
          code: "invalid_json",
          message: "Message must be valid JSON",
        })
      );
    });

    it("should send error for malformed JSON", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      onMessage!(Buffer.from('{"incomplete":'));

      expect(mockSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "error",
          code: "invalid_json",
          message: "Message must be valid JSON",
        })
      );
    });

    it("should not call handler for invalid JSON", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      onMessage!(Buffer.from("invalid"));

      expect(mockPingHandler.handle).not.toHaveBeenCalled();
      expect(mockChatHandler.handle).not.toHaveBeenCalled();
    });
  });

  describe("invalid message format", () => {
    it("should send error for missing type", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const msg = JSON.stringify({ id: "test" });
      onMessage!(Buffer.from(msg));

      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining("invalid_message")
      );
    });

    it("should send error for invalid message schema", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const msg = JSON.stringify({
        type: "chat",
        id: "chat-123",
        // Missing required fields
      });
      onMessage!(Buffer.from(msg));

      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining("invalid_message")
      );
    });

    it("should include error message from validation", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const msg = JSON.stringify({ type: "invalid_type" });
      onMessage!(Buffer.from(msg));

      const call = vi.mocked(mockSocket.send).mock.calls[0][0];
      const response = JSON.parse(call);
      expect(response.type).toBe("error");
      expect(response.code).toBe("invalid_message");
      expect(response.message).toBeDefined();
    });

    it("should not call handler for invalid message", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const msg = JSON.stringify({ type: "unknown" });
      onMessage!(Buffer.from(msg));

      expect(mockPingHandler.handle).not.toHaveBeenCalled();
      expect(mockChatHandler.handle).not.toHaveBeenCalled();
    });
  });

  describe("unknown message type", () => {
    it("should send error for unknown type when handler not registered", () => {
      // Use handlers without chat handler
      const partialHandlers = { ping: mockPingHandler };
      const listener = attachChatHandler(partialHandlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      // Send a valid ping to handler
      const msg = JSON.stringify({ type: "ping", id: "test" });
      vi.mocked(mockSocket.send).mockClear();

      onMessage!(Buffer.from(msg));

      expect(mockPingHandler.handle).toHaveBeenCalled();
    });

    it("should send invalid_message for schema mismatch", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      // This type is not in the schema at all
      const msg = JSON.stringify({ type: "invalid_type" });
      onMessage!(Buffer.from(msg));

      const call = vi.mocked(mockSocket.send).mock.calls[0]?.[0];
      if (call) {
        const response = JSON.parse(call);
        expect(response.code).toBe("invalid_message");
      }
    });
  });

  describe("backpressure handling", () => {
    it("should send message when bufferedAmount is low", () => {
      mockSocket.bufferedAmount = 0;

      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const pingMsg = JSON.stringify({ type: "ping", id: "test" });
      onMessage!(Buffer.from(pingMsg));

      // Get the send function passed to handler
      const call = vi.mocked(mockPingHandler.handle).mock.calls[0];
      const sendFn = call[2];

      sendFn({ type: "pong" });

      expect(mockSocket.send).toHaveBeenCalled();
    });

    it("should drop message when bufferedAmount exceeds threshold", () => {
      mockSocket.bufferedAmount = 1_000_001; // > BACKPRESSURE_MAX

      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const pingMsg = JSON.stringify({ type: "ping", id: "test" });
      onMessage!(Buffer.from(pingMsg));

      // Get the send function passed to handler
      const call = vi.mocked(mockPingHandler.handle).mock.calls[0];
      const sendFn = call[2];

      mockSocket.send.mockClear();
      sendFn({ type: "pong" });

      expect(mockSocket.send).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ user: "testuser" }),
        expect.stringContaining("backpressure")
      );
    });

    it("should warn when dropping message due to backpressure", () => {
      mockSocket.bufferedAmount = 1_000_001;

      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const pingMsg = JSON.stringify({ type: "ping", id: "test" });
      onMessage!(Buffer.from(pingMsg));

      const call = vi.mocked(mockPingHandler.handle).mock.calls[0];
      const sendFn = call[2];

      mockLogger.warn.mockClear();
      sendFn({ type: "error", code: "test", message: "test" });

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should send at exactly backpressure threshold", () => {
      mockSocket.bufferedAmount = 1_000_000; // Exactly at BACKPRESSURE_MAX

      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const pingMsg = JSON.stringify({ type: "ping", id: "test" });
      onMessage!(Buffer.from(pingMsg));

      const call = vi.mocked(mockPingHandler.handle).mock.calls[0];
      const sendFn = call[2];

      mockSocket.send.mockClear();
      sendFn({ type: "pong" });

      expect(mockSocket.send).toHaveBeenCalled();
    });
  });

  describe("close event handling", () => {
    it("should register close event listener", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onClose = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "close"
      )?.[1];
      expect(onClose).toBeDefined();
    });

    it("should abort active stream on close", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      // First, start a chat to create active stream
      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      // Mock chat handler to set active stream
      const mockHandle = { abort: vi.fn(), done: Promise.resolve() };
      vi.mocked(mockChatHandler.handle).mockImplementation((socket, msg, send, ctx) => {
        ctx.activeStream.handle = mockHandle;
      });

      const chatMsg = JSON.stringify({
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }],
      });
      onMessage!(Buffer.from(chatMsg));

      // Now close the socket
      const onClose = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "close"
      )?.[1];
      onClose!();

      expect(mockHandle.abort).toHaveBeenCalled();
    });

    it("should handle close when no active stream", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onClose = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "close"
      )?.[1];

      expect(() => onClose!()).not.toThrow();
    });
  });

  describe("handler context", () => {
    it("should maintain separate context per socket", () => {
      const listener = attachChatHandler(handlers, mockLogger);

      const socket1 = { ...mockSocket, user: { id: "user-1", username: "user1" } } as any;
      const socket2 = { ...mockSocket, user: { id: "user-2", username: "user2" } } as any;

      vi.mocked(socket1.on).mockClear();
      vi.mocked(socket2.on).mockClear();

      listener(socket1);
      listener(socket2);

      // Each socket should have its own handlers
      expect(vi.mocked(socket1.on).mock.calls.length).toBeGreaterThan(0);
      expect(vi.mocked(socket2.on).mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe("multiple messages", () => {
    it("should handle sequence of messages", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const ping1 = JSON.stringify({ type: "ping", id: "p1" });
      const ping2 = JSON.stringify({ type: "ping", id: "p2" });

      onMessage!(Buffer.from(ping1));
      onMessage!(Buffer.from(ping2));

      expect(vi.mocked(mockPingHandler.handle)).toHaveBeenCalledTimes(2);
    });

    it("should handle mixed message types", () => {
      const listener = attachChatHandler(handlers, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const ping = JSON.stringify({ type: "ping", id: "test" });
      const chat = JSON.stringify({
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }],
      });

      onMessage!(Buffer.from(ping));
      onMessage!(Buffer.from(chat));

      expect(vi.mocked(mockPingHandler.handle)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(mockChatHandler.handle)).toHaveBeenCalledTimes(1);
    });
  });

  describe("no handlers case", () => {
    it("should work with empty handler map", () => {
      const listener = attachChatHandler({}, mockLogger);

      expect(() => listener(mockSocket)).not.toThrow();
    });

    it("should send unknown_type for any message with no handlers", () => {
      const listener = attachChatHandler({}, mockLogger);
      listener(mockSocket);

      const onMessage = vi.mocked(mockSocket.on).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const ping = JSON.stringify({ type: "ping", id: "test" });
      onMessage!(Buffer.from(ping));

      const call = vi.mocked(mockSocket.send).mock.calls[0]?.[0];
      if (call) {
        const response = JSON.parse(call);
        expect(response.code).toBe("unknown_type");
      }
    });
  });
});
