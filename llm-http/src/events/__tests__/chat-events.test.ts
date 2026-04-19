import { describe, it, expect } from "vitest";
import { isChatEvent } from "@ai-connect/shared";

describe("isChatEvent", () => {
  describe("valid events", () => {
    it("should return true for chat.requested event", () => {
      const event = {
        type: "chat.requested",
        requestId: "req-1",
        userId: "user-1",
        conversationId: "conv-1",
        model: "gpt-4",
        messages: [],
      };
      expect(isChatEvent(event)).toBe(true);
    });

    it("should return true for stream.started event", () => {
      const event = {
        type: "stream.started",
        requestId: "req-1",
        userId: "user-1",
        conversationId: "conv-1",
        model: "gpt-4",
        startedAt: Date.now(),
      };
      expect(isChatEvent(event)).toBe(true);
    });

    it("should return true for token.generated event", () => {
      const event = {
        type: "token.generated",
        requestId: "req-1",
        delta: { kind: "text", text: "hello" },
        index: 0,
      };
      expect(isChatEvent(event)).toBe(true);
    });

    it("should return true for tool.call event", () => {
      const event = {
        type: "tool.call",
        requestId: "req-1",
        toolCallId: "tc-1",
        name: "search",
        arguments: "{}",
      };
      expect(isChatEvent(event)).toBe(true);
    });

    it("should return true for stream.completed event", () => {
      const event = {
        type: "stream.completed",
        requestId: "req-1",
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        finishReason: "stop",
        latencyMs: 100,
      };
      expect(isChatEvent(event)).toBe(true);
    });

    it("should return true for stream.failed event", () => {
      const event = {
        type: "stream.failed",
        requestId: "req-1",
        code: "ERROR",
        message: "Something went wrong",
      };
      expect(isChatEvent(event)).toBe(true);
    });

    it("should return true for stream.aborted event", () => {
      const event = {
        type: "stream.aborted",
        requestId: "req-1",
        reason: "client",
      };
      expect(isChatEvent(event)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    it("should return false for null", () => {
      expect(isChatEvent(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isChatEvent(undefined)).toBe(false);
    });

    it("should return false for primitive values", () => {
      expect(isChatEvent("string")).toBe(false);
      expect(isChatEvent(123)).toBe(false);
      expect(isChatEvent(true)).toBe(false);
    });

    it("should return false for object without type property", () => {
      expect(isChatEvent({ foo: "bar" })).toBe(false);
    });

    it("should return false for object with non-string type", () => {
      expect(isChatEvent({ type: 123 })).toBe(false);
      expect(isChatEvent({ type: null })).toBe(false);
    });

    it("should return false for unknown event types", () => {
      expect(isChatEvent({ type: "unknown.event" })).toBe(false);
      expect(isChatEvent({ type: "chat.unknown" })).toBe(false);
      expect(isChatEvent({ type: "stream" })).toBe(false);
    });

    it("should return false for partial prefix matches", () => {
      expect(isChatEvent({ type: "chat." })).toBe(false);
      expect(isChatEvent({ type: "stream." })).toBe(false);
    });
  });
});
