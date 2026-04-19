import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatHandler } from "../chat-handler.js";
import { EventBus } from "../../events/event-bus.js";
import type { ChatEvent, ChatRequested } from "@ai-connect/shared";
import type { ChatGatewayPort } from "../../chat/chat-gateway-port.js";
import type { StreamChunk, TokenUsage, FinishReason } from "llm-gateway";
import type { Logger } from "../../logger.js";

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: "info",
  } as unknown as Logger;
}

function createMockGateway(): ChatGatewayPort {
  return {
    chat: vi.fn(),
    stream: vi.fn(),
    getMetrics: vi.fn().mockReturnValue({ providers: [] }),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

async function* yieldChunks(chunks: StreamChunk[]): AsyncIterable<StreamChunk> {
  for (const chunk of chunks) yield chunk;
}

describe("ChatHandler", () => {
  let bus: EventBus<ChatEvent>;
  let gateway: ChatGatewayPort;
  let logger: Logger;
  let handler: ChatHandler;

  const baseChatRequested: ChatRequested = {
    type: "chat.requested",
    requestId: "req-1",
    userId: "user-1",
    conversationId: "conv-1",
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello" }],
  };

  beforeEach(() => {
    bus = new EventBus<ChatEvent>();
    gateway = createMockGateway();
    logger = createMockLogger();
    handler = new ChatHandler(bus, gateway, logger);
  });

  describe("happy path", () => {
    it("emits stream.started, token.generated, and stream.completed", async () => {
      const events: ChatEvent[] = [];
      bus.subscribe("stream.started", (e) => events.push(e));
      bus.subscribe("token.generated", (e) => events.push(e));
      bus.subscribe("stream.completed", (e) => events.push(e));

      const chunks: StreamChunk[] = [
        { id: "c1", delta: { type: "text", text: "Hello" } },
        { id: "c2", delta: { type: "text", text: " world" } },
        {
          id: "c3",
          delta: { type: "text", text: "!" },
          finishReason: "stop" as FinishReason,
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } as TokenUsage,
        },
      ];

      vi.mocked(gateway.stream).mockReturnValue(yieldChunks(chunks));
      handler.start();
      await bus.publish(baseChatRequested);
      await vi.waitFor(() => expect(events.length).toBe(5));

      expect(events[0].type).toBe("stream.started");
      expect(events[1]).toMatchObject({ type: "token.generated", index: 0 });
      expect(events[2]).toMatchObject({ type: "token.generated", index: 1 });
      expect(events[3]).toMatchObject({ type: "token.generated", index: 2 });
      expect(events[4].type).toBe("stream.completed");
    });

    it("increments index monotonically", async () => {
      const indices: number[] = [];
      bus.subscribe("token.generated", (e) => indices.push(e.index));

      const chunks: StreamChunk[] = [
        { id: "c1", delta: { type: "text", text: "a" } },
        { id: "c2", delta: { type: "text", text: "b" } },
        { id: "c3", delta: { type: "text", text: "c" } },
        { id: "c4", delta: { type: "text", text: "d" }, finishReason: "stop", usage: { inputTokens: 1, outputTokens: 4, totalTokens: 5 } },
      ];

      vi.mocked(gateway.stream).mockReturnValue(yieldChunks(chunks));
      handler.start();
      await bus.publish(baseChatRequested);
      await vi.waitFor(() => expect(indices.length).toBe(4));

      expect(indices).toEqual([0, 1, 2, 3]);
    });
  });

  describe("tool call handling", () => {
    it("emits token.generated with tool_use_start kind", async () => {
      const events: ChatEvent[] = [];
      bus.subscribe("token.generated", (e) => events.push(e));

      const chunks: StreamChunk[] = [
        {
          id: "c1",
          delta: {
            type: "tool_call_start",
            toolCall: { id: "tc-1", type: "function", function: { name: "search", arguments: "" } },
          },
        },
        { id: "c2", delta: undefined as unknown as StreamChunk["delta"], finishReason: "tool_calls", usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
      ];

      vi.mocked(gateway.stream).mockReturnValue(yieldChunks(chunks));
      handler.start();
      await bus.publish(baseChatRequested);
      await vi.waitFor(() => expect(events.length).toBe(1));

      expect(events[0]).toMatchObject({
        type: "token.generated",
        delta: { kind: "tool_use_start", toolCallId: "tc-1", name: "search" },
      });
    });
  });

  describe("error handling", () => {
    it("emits stream.failed when gateway throws", async () => {
      let failedEvent: ChatEvent | null = null;
      bus.subscribe("stream.failed", (e) => (failedEvent = e));

      const error = new Error("Network error");
      error.name = "TimeoutError";
      vi.mocked(gateway.stream).mockImplementation(async function* () {
        throw error;
      });

      handler.start();
      await bus.publish(baseChatRequested);
      await vi.waitFor(() => expect(failedEvent).not.toBeNull());

      expect(failedEvent).toMatchObject({
        type: "stream.failed",
        requestId: "req-1",
        code: "provider_timeout",
      });
    });

    it("drops chunks with no delta and no finishReason", async () => {
      const events: ChatEvent[] = [];
      bus.subscribe("token.generated", (e) => events.push(e));

      const chunks: StreamChunk[] = [
        { id: "c1", delta: undefined as unknown as StreamChunk["delta"] },
        { id: "c2", delta: { type: "text", text: "ok" }, finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ];

      vi.mocked(gateway.stream).mockReturnValue(yieldChunks(chunks));
      handler.start();
      await bus.publish(baseChatRequested);
      await vi.waitFor(() => expect(events.length).toBe(1));

      expect(events[0].type).toBe("token.generated");
    });
  });

  describe("abort handling", () => {
    it("emits stream.aborted when abort is called", async () => {
      let abortedEvent: ChatEvent | null = null;
      bus.subscribe("stream.aborted", (e) => (abortedEvent = e));

      vi.mocked(gateway.stream).mockImplementation(async function* (_req, signal) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        yield { id: "c1", delta: { type: "text", text: "ok" } };
      });

      handler.start();
      const publishPromise = bus.publish(baseChatRequested);
      await new Promise((r) => setTimeout(r, 10));
      handler.abort("req-1", "manual");
      await publishPromise;
      await vi.waitFor(() => expect(abortedEvent).not.toBeNull());

      expect(abortedEvent).toMatchObject({
        type: "stream.aborted",
        requestId: "req-1",
        reason: "manual",
      });
    });

    it("does nothing when aborting non-existent request", () => {
      handler.start();
      expect(() => handler.abort("non-existent")).not.toThrow();
    });
  });

  describe("dispose", () => {
    it("aborts all in-flight and unsubscribes", async () => {
      const events: ChatEvent[] = [];
      bus.subscribe("stream.started", (e) => events.push(e));

      vi.mocked(gateway.stream).mockImplementation(async function* (_req, signal) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        yield { id: "c1", delta: { type: "text", text: "ok" }, finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } };
      });

      handler.start();
      const p1 = bus.publish(baseChatRequested);
      await new Promise((r) => setTimeout(r, 10));
      await handler.dispose();
      await p1;

      events.length = 0;
      await bus.publish({ ...baseChatRequested, requestId: "req-2" });
      await new Promise((r) => setTimeout(r, 50));
      expect(events.filter((e) => e.type === "stream.started" && e.requestId === "req-2")).toHaveLength(0);
    });
  });
});
