import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChatRequest, ChatResponse } from "../../core/index.js";

const mockRequest: ChatRequest = {
  model: "claude-sonnet-4-20250514",
  messages: [{ role: "user", content: "Hello" }],
  maxTokens: 100,
  temperature: 0.7,
  tools: [
    {
      type: "function",
      function: {
        name: "test",
        description: "Test function",
        parameters: { type: "object" },
      },
    },
  ],
};

const mockResponse: ChatResponse = {
  id: "test-id",
  content: "Hello there!",
  toolCalls: [],
  usage: {
    inputTokens: 10,
    outputTokens: 20,
    totalTokens: 30,
  },
  model: "claude-sonnet-4-20250514",
  finishReason: "stop",
  latencyMs: 150,
};

describe("LLMTracer", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("disabled telemetry", () => {
    it("returns no-op span when disabled", async () => {
      const { LLMTracer } = await import("../tracer.js");
      const tracer = new LLMTracer({ enabled: false });
      const span = tracer.startChatSpan();

      expect(tracer.isEnabled()).toBe(false);
      // Should not throw - no-op operations
      span.setRequestAttributes(mockRequest, "anthropic");
      span.setResponseAttributes(mockResponse);
      span.recordError(new Error("test"));
      span.end();
    });

    it("returns no-op span when config undefined", async () => {
      const { LLMTracer } = await import("../tracer.js");
      const tracer = new LLMTracer(undefined);
      expect(tracer.isEnabled()).toBe(false);
    });

    it("returns no-op stream span when disabled", async () => {
      const { LLMTracer } = await import("../tracer.js");
      const tracer = new LLMTracer({ enabled: false });
      const span = tracer.startStreamSpan();

      expect(tracer.isEnabled()).toBe(false);
      span.setRequestAttributes(mockRequest, "openai");
      span.end();
    });
  });

  describe("enabled telemetry with OTel available", () => {
    it("creates tracer when enabled", async () => {
      const { LLMTracer } = await import("../tracer.js");
      const tracer = new LLMTracer({
        enabled: true,
        serviceName: "test-service",
        serviceVersion: "1.0.0",
      });

      // OTel is installed in devDeps, so tracer should be enabled
      expect(tracer.isEnabled()).toBe(true);
    });

    it("creates chat span when enabled", async () => {
      const { LLMTracer } = await import("../tracer.js");
      const tracer = new LLMTracer({ enabled: true });

      const span = tracer.startChatSpan("custom.operation");
      expect(span).toBeDefined();
      // Should not throw
      span.setRequestAttributes(mockRequest, "anthropic");
      span.setResponseAttributes(mockResponse);
      span.end();
    });

    it("creates stream span when enabled", async () => {
      const { LLMTracer } = await import("../tracer.js");
      const tracer = new LLMTracer({ enabled: true });

      const span = tracer.startStreamSpan();
      expect(span).toBeDefined();
      span.setRequestAttributes(mockRequest, "ollama");
      span.end();
    });

    it("records error on span", async () => {
      const { LLMTracer } = await import("../tracer.js");
      const tracer = new LLMTracer({ enabled: true });

      const span = tracer.startChatSpan();
      // Should not throw
      span.recordError(new Error("test error"));
      span.end();
    });

    it("uses default service name when not provided", async () => {
      const { LLMTracer } = await import("../tracer.js");
      const tracer = new LLMTracer({ enabled: true });

      expect(tracer.isEnabled()).toBe(true);
    });

    it("handles request without temperature", async () => {
      const { LLMTracer } = await import("../tracer.js");
      const tracer = new LLMTracer({ enabled: true });

      const span = tracer.startChatSpan();
      const requestWithoutTemp: ChatRequest = {
        model: "test",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 100,
      };
      span.setRequestAttributes(requestWithoutTemp, "anthropic");
      span.end();
    });

    it("handles request without tools", async () => {
      const { LLMTracer } = await import("../tracer.js");
      const tracer = new LLMTracer({ enabled: true });

      const span = tracer.startChatSpan();
      const requestWithoutTools: ChatRequest = {
        model: "test",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 100,
      };
      span.setRequestAttributes(requestWithoutTools, "openai");
      span.end();
    });
  });
});

describe("LLMMetrics", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("disabled metrics", () => {
    it("no-op when disabled", async () => {
      const { LLMMetrics } = await import("../metrics.js");
      const metrics = new LLMMetrics({ enabled: false });

      expect(metrics.isEnabled()).toBe(false);
      // Should not throw - all no-op
      metrics.recordRequest("anthropic", "claude-sonnet-4-20250514", false);
      metrics.recordError("anthropic", "RATE_LIMIT");
      metrics.recordLatency("anthropic", "claude-sonnet-4-20250514", 100);
      metrics.recordTokens("anthropic", "claude-sonnet-4-20250514", 10, 20);
    });

    it("no-op when config undefined", async () => {
      const { LLMMetrics } = await import("../metrics.js");
      const metrics = new LLMMetrics(undefined);
      expect(metrics.isEnabled()).toBe(false);
    });
  });

  describe("enabled metrics with OTel available", () => {
    it("creates meter when enabled", async () => {
      const { LLMMetrics } = await import("../metrics.js");
      const metrics = new LLMMetrics({
        enabled: true,
        serviceName: "test-service",
        serviceVersion: "1.0.0",
      });

      expect(metrics.isEnabled()).toBe(true);
    });

    it("records request", async () => {
      const { LLMMetrics } = await import("../metrics.js");
      const metrics = new LLMMetrics({ enabled: true });

      // Should not throw
      metrics.recordRequest("anthropic", "claude-sonnet-4-20250514", false);
      metrics.recordRequest("openai", "gpt-4", true);
    });

    it("records error", async () => {
      const { LLMMetrics } = await import("../metrics.js");
      const metrics = new LLMMetrics({ enabled: true });

      metrics.recordError("openai", "RATE_LIMIT");
      metrics.recordError("anthropic", "TIMEOUT");
    });

    it("records latency", async () => {
      const { LLMMetrics } = await import("../metrics.js");
      const metrics = new LLMMetrics({ enabled: true });

      metrics.recordLatency("anthropic", "claude-sonnet-4-20250514", 150);
      metrics.recordLatency("openai", "gpt-4", 200);
    });

    it("records token usage", async () => {
      const { LLMMetrics } = await import("../metrics.js");
      const metrics = new LLMMetrics({ enabled: true });

      metrics.recordTokens("anthropic", "claude-sonnet-4-20250514", 10, 20);
      metrics.recordTokens("openai", "gpt-4", 100, 200);
    });

    it("uses default service name when not provided", async () => {
      const { LLMMetrics } = await import("../metrics.js");
      const metrics = new LLMMetrics({ enabled: true });

      expect(metrics.isEnabled()).toBe(true);
    });
  });
});

describe("Telemetry barrel exports", () => {
  it("exports LLMTracer", async () => {
    const { LLMTracer } = await import("../index.js");
    expect(LLMTracer).toBeDefined();
  });

  it("exports LLMMetrics", async () => {
    const { LLMMetrics } = await import("../index.js");
    expect(LLMMetrics).toBeDefined();
  });
});
