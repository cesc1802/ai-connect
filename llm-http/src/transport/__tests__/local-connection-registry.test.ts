import { describe, it, expect, vi, beforeEach } from "vitest";
import { LocalConnectionRegistry } from "../local-connection-registry.js";
import type { Connection } from "../connection-registry.js";

function createMockConnection(id: string, userId: string): Connection {
  return {
    id,
    userId,
    send: vi.fn(),
    close: vi.fn(),
  };
}

describe("LocalConnectionRegistry", () => {
  let registry: LocalConnectionRegistry;

  beforeEach(() => {
    registry = new LocalConnectionRegistry();
  });

  describe("register", () => {
    it("should store connection retrievable by id", () => {
      const conn = createMockConnection("conn-1", "user-1");
      registry.register(conn);

      expect(registry.getByConnection("conn-1")).toBe(conn);
    });

    it("should store connection retrievable by user", () => {
      const conn = createMockConnection("conn-1", "user-1");
      registry.register(conn);

      expect(registry.getByUser("user-1")).toEqual([conn]);
    });

    it("should overwrite when same id registered twice", () => {
      const conn1 = createMockConnection("conn-1", "user-1");
      const conn2 = createMockConnection("conn-1", "user-2");

      registry.register(conn1);
      registry.register(conn2);

      expect(registry.getByConnection("conn-1")).toBe(conn2);
    });

    it("should clean up old user index when re-registering with different userId", () => {
      const conn1 = createMockConnection("conn-1", "user-1");
      const conn2 = createMockConnection("conn-1", "user-2");

      registry.register(conn1);
      expect(registry.getByUser("user-1")).toEqual([conn1]);

      registry.register(conn2);
      expect(registry.getByUser("user-1")).toEqual([]);
      expect(registry.getByUser("user-2")).toEqual([conn2]);
    });
  });

  describe("multi-tab support", () => {
    it("should return all connections for same user", () => {
      const conn1 = createMockConnection("conn-1", "user-1");
      const conn2 = createMockConnection("conn-2", "user-1");
      const conn3 = createMockConnection("conn-3", "user-1");

      registry.register(conn1);
      registry.register(conn2);
      registry.register(conn3);

      const userConns = registry.getByUser("user-1");
      expect(userConns).toHaveLength(3);
      expect(userConns).toContain(conn1);
      expect(userConns).toContain(conn2);
      expect(userConns).toContain(conn3);
    });

    it("should isolate connections between users", () => {
      const conn1 = createMockConnection("conn-1", "user-1");
      const conn2 = createMockConnection("conn-2", "user-2");

      registry.register(conn1);
      registry.register(conn2);

      expect(registry.getByUser("user-1")).toEqual([conn1]);
      expect(registry.getByUser("user-2")).toEqual([conn2]);
    });
  });

  describe("unregister", () => {
    it("should remove connection from id index", () => {
      const conn = createMockConnection("conn-1", "user-1");
      registry.register(conn);
      registry.unregister("conn-1");

      expect(registry.getByConnection("conn-1")).toBeUndefined();
    });

    it("should remove connection from user index", () => {
      const conn = createMockConnection("conn-1", "user-1");
      registry.register(conn);
      registry.unregister("conn-1");

      expect(registry.getByUser("user-1")).toEqual([]);
    });

    it("should clean up user set when last connection removed", () => {
      const conn1 = createMockConnection("conn-1", "user-1");
      const conn2 = createMockConnection("conn-2", "user-1");

      registry.register(conn1);
      registry.register(conn2);
      registry.unregister("conn-1");

      expect(registry.getByUser("user-1")).toEqual([conn2]);

      registry.unregister("conn-2");
      expect(registry.getByUser("user-1")).toEqual([]);
    });

    it("should not throw when unregistering unknown id", () => {
      expect(() => registry.unregister("unknown")).not.toThrow();
    });

    it("should not affect other users when unregistering", () => {
      const conn1 = createMockConnection("conn-1", "user-1");
      const conn2 = createMockConnection("conn-2", "user-2");

      registry.register(conn1);
      registry.register(conn2);
      registry.unregister("conn-1");

      expect(registry.getByUser("user-2")).toEqual([conn2]);
    });
  });

  describe("getByConnection", () => {
    it("should return undefined for unknown id", () => {
      expect(registry.getByConnection("unknown")).toBeUndefined();
    });
  });

  describe("getByUser", () => {
    it("should return empty array for unknown user", () => {
      expect(registry.getByUser("unknown")).toEqual([]);
    });

    it("should return snapshot array safe for iteration during mutation", () => {
      const conn1 = createMockConnection("conn-1", "user-1");
      const conn2 = createMockConnection("conn-2", "user-1");

      registry.register(conn1);
      registry.register(conn2);

      const snapshot = registry.getByUser("user-1");
      registry.unregister("conn-1");

      expect(snapshot).toHaveLength(2);
      expect(registry.getByUser("user-1")).toHaveLength(1);
    });
  });
});
