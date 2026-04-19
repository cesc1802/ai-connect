import { describe, it, expect, vi, beforeEach } from "vitest";
import { LocalMessageRouter } from "../local-message-router.js";
import { LocalConnectionRegistry } from "../local-connection-registry.js";
import type { Connection } from "../connection-registry.js";
import type { Logger } from "pino";

function createMockConnection(id: string, userId: string): Connection {
  return {
    id,
    userId,
    send: vi.fn(),
    close: vi.fn(),
  };
}

function createMockLogger(): Logger {
  return {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: "info",
  } as unknown as Logger;
}

describe("LocalMessageRouter", () => {
  let registry: LocalConnectionRegistry;
  let router: LocalMessageRouter;
  let mockLogger: Logger;

  beforeEach(() => {
    registry = new LocalConnectionRegistry();
    mockLogger = createMockLogger();
    router = new LocalMessageRouter(registry, mockLogger);
  });

  describe("sendToConnection", () => {
    it("should call send on connection with payload", () => {
      const conn = createMockConnection("conn-1", "user-1");
      registry.register(conn);

      const payload = { type: "message", text: "hello" };
      router.sendToConnection("conn-1", payload);

      expect(conn.send).toHaveBeenCalledTimes(1);
      expect(conn.send).toHaveBeenCalledWith(payload);
    });

    it("should log debug when connection not found", () => {
      router.sendToConnection("unknown", { data: "test" });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        { connectionId: "unknown" },
        "router: connection not found"
      );
    });

    it("should not throw when connection not found", () => {
      expect(() => router.sendToConnection("unknown", {})).not.toThrow();
    });
  });

  describe("sendToUser", () => {
    it("should fan out to all user connections", () => {
      const conn1 = createMockConnection("conn-1", "user-1");
      const conn2 = createMockConnection("conn-2", "user-1");
      const conn3 = createMockConnection("conn-3", "user-1");

      registry.register(conn1);
      registry.register(conn2);
      registry.register(conn3);

      const payload = { type: "title.updated", title: "New Chat" };
      router.sendToUser("user-1", payload);

      expect(conn1.send).toHaveBeenCalledWith(payload);
      expect(conn2.send).toHaveBeenCalledWith(payload);
      expect(conn3.send).toHaveBeenCalledWith(payload);
    });

    it("should not call send when user has no connections", () => {
      router.sendToUser("unknown-user", { data: "test" });
    });

    it("should not throw when user has no connections", () => {
      expect(() => router.sendToUser("unknown", {})).not.toThrow();
    });

    it("should only send to specified user", () => {
      const conn1 = createMockConnection("conn-1", "user-1");
      const conn2 = createMockConnection("conn-2", "user-2");

      registry.register(conn1);
      registry.register(conn2);

      router.sendToUser("user-1", { data: "test" });

      expect(conn1.send).toHaveBeenCalled();
      expect(conn2.send).not.toHaveBeenCalled();
    });
  });

  describe("payload handling", () => {
    it("should pass payload directly without modification", () => {
      const conn = createMockConnection("conn-1", "user-1");
      registry.register(conn);

      const complexPayload = {
        type: "stream.chunk",
        data: { nested: { value: 123 } },
        array: [1, 2, 3],
      };
      router.sendToConnection("conn-1", complexPayload);

      expect(conn.send).toHaveBeenCalledWith(complexPayload);
    });
  });
});
