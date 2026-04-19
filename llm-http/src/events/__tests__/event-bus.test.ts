import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBus } from "../event-bus.js";
import type { Logger } from "../../logger.js";

type TestEvent =
  | { type: "user.created"; userId: string; name: string }
  | { type: "user.deleted"; userId: string }
  | { type: "order.placed"; orderId: string; amount: number };

describe("EventBus", () => {
  let eventBus: EventBus<TestEvent>;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn().mockReturnThis(),
      level: "info",
    } as unknown as Logger;
    eventBus = new EventBus<TestEvent>({ logger: mockLogger });
  });

  describe("publish with no subscribers", () => {
    it("should not throw when publishing to empty bus", async () => {
      const event: TestEvent = { type: "user.created", userId: "1", name: "Test" };
      await expect(eventBus.publish(event)).resolves.toBeUndefined();
    });

    it("should not throw when event type has no subscribers", async () => {
      const handler = vi.fn();
      eventBus.subscribe("user.deleted", handler);

      const event: TestEvent = { type: "user.created", userId: "1", name: "Test" };
      await expect(eventBus.publish(event)).resolves.toBeUndefined();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("subscribe and publish", () => {
    it("should invoke handler with typed event", async () => {
      const handler = vi.fn();
      eventBus.subscribe("user.created", handler);

      const event: TestEvent = { type: "user.created", userId: "1", name: "Alice" };
      await eventBus.publish(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it("should only call handlers for matching event type", async () => {
      const createdHandler = vi.fn();
      const deletedHandler = vi.fn();
      eventBus.subscribe("user.created", createdHandler);
      eventBus.subscribe("user.deleted", deletedHandler);

      await eventBus.publish({ type: "user.created", userId: "1", name: "Bob" });

      expect(createdHandler).toHaveBeenCalledTimes(1);
      expect(deletedHandler).not.toHaveBeenCalled();
    });
  });

  describe("multiple subscribers", () => {
    it("should invoke all handlers via Promise.allSettled", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      eventBus.subscribe("order.placed", handler1);
      eventBus.subscribe("order.placed", handler2);
      eventBus.subscribe("order.placed", handler3);

      const event: TestEvent = { type: "order.placed", orderId: "ord-1", amount: 100 };
      await eventBus.publish(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
      expect(handler3).toHaveBeenCalledWith(event);
    });

    it("should handle async handlers", async () => {
      const results: number[] = [];
      const handler1 = vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(1);
      });
      const handler2 = vi.fn(async () => {
        results.push(2);
      });

      eventBus.subscribe("user.created", handler1);
      eventBus.subscribe("user.created", handler2);

      await eventBus.publish({ type: "user.created", userId: "1", name: "Test" });

      expect(results).toContain(1);
      expect(results).toContain(2);
    });
  });

  describe("error handling", () => {
    it("should continue other handlers when one throws", async () => {
      const failingHandler = vi.fn(() => {
        throw new Error("Handler failed");
      });
      const successHandler = vi.fn();

      eventBus.subscribe("user.created", failingHandler);
      eventBus.subscribe("user.created", successHandler);

      await eventBus.publish({ type: "user.created", userId: "1", name: "Test" });

      expect(failingHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });

    it("should log error when handler throws", async () => {
      const error = new Error("Handler error");
      const failingHandler = vi.fn(() => {
        throw error;
      });

      eventBus.subscribe("user.deleted", failingHandler);
      await eventBus.publish({ type: "user.deleted", userId: "1" });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error, eventType: "user.deleted" }),
        "Event handler failed"
      );
    });

    it("should log error when async handler rejects", async () => {
      const error = new Error("Async handler error");
      const failingHandler = vi.fn(async () => {
        throw error;
      });

      eventBus.subscribe("order.placed", failingHandler);
      await eventBus.publish({ type: "order.placed", orderId: "1", amount: 50 });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error, eventType: "order.placed" }),
        "Event handler failed"
      );
    });
  });

  describe("unsubscribe", () => {
    it("should return unsubscribe function that removes handler", async () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe("user.created", handler);

      await eventBus.publish({ type: "user.created", userId: "1", name: "Test" });
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      await eventBus.publish({ type: "user.created", userId: "2", name: "Test2" });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should only remove the specific handler", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unsubscribe1 = eventBus.subscribe("user.deleted", handler1);
      eventBus.subscribe("user.deleted", handler2);

      unsubscribe1();

      await eventBus.publish({ type: "user.deleted", userId: "1" });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it("should be safe to call unsubscribe multiple times", () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe("user.created", handler);

      expect(() => {
        unsubscribe();
        unsubscribe();
        unsubscribe();
      }).not.toThrow();
    });
  });

  describe("type narrowing", () => {
    it("should provide correct type in handler (compile-time + runtime check)", async () => {
      eventBus.subscribe("user.created", (event) => {
        expect(event.type).toBe("user.created");
        expect(event.userId).toBeDefined();
        expect(event.name).toBeDefined();
        expect("amount" in event).toBe(false);
      });

      eventBus.subscribe("order.placed", (event) => {
        expect(event.type).toBe("order.placed");
        expect(event.orderId).toBeDefined();
        expect(event.amount).toBeDefined();
        expect("name" in event).toBe(false);
      });

      await eventBus.publish({ type: "user.created", userId: "1", name: "Alice" });
      await eventBus.publish({ type: "order.placed", orderId: "o1", amount: 200 });
    });
  });

  describe("without logger", () => {
    it("should not throw when handler fails and no logger provided", async () => {
      const busWithoutLogger = new EventBus<TestEvent>();
      const failingHandler = vi.fn(() => {
        throw new Error("No logger error");
      });

      busWithoutLogger.subscribe("user.created", failingHandler);

      await expect(
        busWithoutLogger.publish({ type: "user.created", userId: "1", name: "Test" })
      ).resolves.toBeUndefined();
    });
  });
});
