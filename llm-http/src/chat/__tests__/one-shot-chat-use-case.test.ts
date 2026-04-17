import { describe, it, expect, vi, beforeEach } from "vitest";
import { OneShotChatUseCase } from "../one-shot-chat-use-case.js";
import type { ChatGatewayPort } from "../chat-gateway-port.js";
import type { ChatRequest, ChatResponse } from "llm-gateway";

const createChatRequest = (overrides?: Partial<ChatRequest>): ChatRequest => ({
  model: "gpt-4",
  messages: [{ role: "user", content: "test" }],
  maxTokens: 4096,
  ...overrides,
});

const createChatResponse = (overrides?: Partial<ChatResponse>): ChatResponse => ({
  content: "Sample response",
  finishReason: "stop",
  usage: { inputTokens: 10, outputTokens: 5 },
  latencyMs: 100,
  ...overrides,
});

describe("OneShotChatUseCase", () => {
  let useCase: OneShotChatUseCase;
  let mockGateway: ChatGatewayPort;

  beforeEach(() => {
    mockGateway = {
      chat: vi.fn(),
      stream: vi.fn(),
      getMetrics: vi.fn(),
      dispose: vi.fn(),
    };

    useCase = new OneShotChatUseCase(mockGateway);
  });

  describe("basic execution", () => {
    it("should execute chat request and return response", async () => {
      const req = createChatRequest();
      const res = createChatResponse();

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const result = await useCase.execute(req);

      expect(result).toEqual(res);
    });

    it("should pass request to gateway.chat", async () => {
      const req = createChatRequest({
        model: "claude-3",
        messages: [{ role: "user", content: "Hello" }],
      });
      const res = createChatResponse();

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      await useCase.execute(req);

      expect(vi.mocked(mockGateway.chat)).toHaveBeenCalledWith(req);
    });

    it("should return full response with all fields", async () => {
      const res = createChatResponse({
        content: "Full response text",
        finishReason: "stop",
        usage: { inputTokens: 100, outputTokens: 50 },
        latencyMs: 234,
      });

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const req = createChatRequest();
      const result = await useCase.execute(req);

      expect(result.content).toBe("Full response text");
      expect(result.finishReason).toBe("stop");
      expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
      expect(result.latencyMs).toBe(234);
    });
  });

  describe("request passthrough", () => {
    it("should pass through minimal request", async () => {
      const req: ChatRequest = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 1000,
      };
      const res = createChatResponse();

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      await useCase.execute(req);

      expect(vi.mocked(mockGateway.chat)).toHaveBeenCalledWith(req);
      expect(vi.mocked(mockGateway.chat)).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4",
          maxTokens: 1000,
        })
      );
    });

    it("should pass through request with temperature", async () => {
      const req = createChatRequest({ temperature: 0.7 });
      const res = createChatResponse();

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      await useCase.execute(req);

      expect(vi.mocked(mockGateway.chat)).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.7 })
      );
    });

    it("should pass through request with multiple messages", async () => {
      const req = createChatRequest({
        messages: [
          { role: "user", content: "First" },
          { role: "assistant", content: "Response" },
          { role: "user", content: "Second" },
        ],
      });
      const res = createChatResponse();

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      await useCase.execute(req);

      expect(vi.mocked(mockGateway.chat)).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ content: "First" }),
            expect.objectContaining({ content: "Response" }),
            expect.objectContaining({ content: "Second" }),
          ]),
        })
      );
    });

    it("should pass through different models", async () => {
      const models = [
        "gpt-4",
        "gpt-3.5-turbo",
        "claude-3-opus",
        "claude-3-sonnet",
      ];
      const res = createChatResponse();

      for (const model of models) {
        vi.mocked(mockGateway.chat).mockResolvedValue(res);
        const req = createChatRequest({ model });

        await useCase.execute(req);

        expect(vi.mocked(mockGateway.chat)).toHaveBeenCalledWith(
          expect.objectContaining({ model })
        );
      }
    });
  });

  describe("response types", () => {
    it("should handle text response", async () => {
      const res = createChatResponse({ content: "Hello, this is a text response" });

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const req = createChatRequest();
      const result = await useCase.execute(req);

      expect(result.content).toBe("Hello, this is a text response");
    });

    it("should handle response with finish reason stop", async () => {
      const res = createChatResponse({ finishReason: "stop" });

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const req = createChatRequest();
      const result = await useCase.execute(req);

      expect(result.finishReason).toBe("stop");
    });

    it("should handle response with finish reason length", async () => {
      const res = createChatResponse({ finishReason: "length" });

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const req = createChatRequest();
      const result = await useCase.execute(req);

      expect(result.finishReason).toBe("length");
    });

    it("should handle response with tool calls", async () => {
      const res = createChatResponse({
        content: "",
        finishReason: "tool_calls",
        toolCalls: [
          {
            id: "call_123",
            function: {
              name: "get_weather",
              arguments: '{"location":"SF"}',
            },
          },
        ],
      });

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const req = createChatRequest();
      const result = await useCase.execute(req);

      expect(result.finishReason).toBe("tool_calls");
      expect(result.toolCalls).toBeDefined();
      expect(result.toolCalls).toHaveLength(1);
    });
  });

  describe("error handling", () => {
    it("should propagate gateway errors", async () => {
      const error = new Error("Gateway error");

      vi.mocked(mockGateway.chat).mockRejectedValue(error);

      const req = createChatRequest();

      await expect(useCase.execute(req)).rejects.toThrow("Gateway error");
    });

    it("should propagate authentication errors", async () => {
      const error = new Error("Invalid API key");

      vi.mocked(mockGateway.chat).mockRejectedValue(error);

      const req = createChatRequest();

      await expect(useCase.execute(req)).rejects.toThrow("Invalid API key");
    });

    it("should propagate rate limit errors", async () => {
      const error = new Error("Rate limited");

      vi.mocked(mockGateway.chat).mockRejectedValue(error);

      const req = createChatRequest();

      await expect(useCase.execute(req)).rejects.toThrow("Rate limited");
    });

    it("should propagate timeout errors", async () => {
      const error = new Error("Request timeout");

      vi.mocked(mockGateway.chat).mockRejectedValue(error);

      const req = createChatRequest();

      await expect(useCase.execute(req)).rejects.toThrow("Request timeout");
    });

    it("should not catch or modify errors", async () => {
      const error = new TypeError("Type error");

      vi.mocked(mockGateway.chat).mockRejectedValue(error);

      const req = createChatRequest();

      await expect(useCase.execute(req)).rejects.toThrow(TypeError);
    });
  });

  describe("gateway interaction", () => {
    it("should call gateway.chat once per execution", async () => {
      const res = createChatResponse();

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const req = createChatRequest();

      await useCase.execute(req);

      expect(vi.mocked(mockGateway.chat)).toHaveBeenCalledTimes(1);
    });

    it("should call gateway.chat multiple times for multiple executions", async () => {
      const res = createChatResponse();

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const req1 = createChatRequest({ messages: [{ role: "user", content: "Q1" }] });
      const req2 = createChatRequest({ messages: [{ role: "user", content: "Q2" }] });

      await useCase.execute(req1);
      await useCase.execute(req2);

      expect(vi.mocked(mockGateway.chat)).toHaveBeenCalledTimes(2);
    });

    it("should not call stream method", async () => {
      const res = createChatResponse();

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const req = createChatRequest();

      await useCase.execute(req);

      expect(vi.mocked(mockGateway.stream)).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle empty response content", async () => {
      const res = createChatResponse({ content: "" });

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const req = createChatRequest();
      const result = await useCase.execute(req);

      expect(result.content).toBe("");
    });

    it("should handle very long response content", async () => {
      const longContent = "a".repeat(100000);
      const res = createChatResponse({ content: longContent });

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const req = createChatRequest();
      const result = await useCase.execute(req);

      expect(result.content).toBe(longContent);
      expect(result.content.length).toBe(100000);
    });

    it("should handle special characters in response", async () => {
      const specialContent = "Hello\nWorld\t!@#$%^&*()";
      const res = createChatResponse({ content: specialContent });

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const req = createChatRequest();
      const result = await useCase.execute(req);

      expect(result.content).toBe(specialContent);
    });

    it("should handle unicode in response", async () => {
      const unicodeContent = "Hello 世界 🌍 مرحبا";
      const res = createChatResponse({ content: unicodeContent });

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const req = createChatRequest();
      const result = await useCase.execute(req);

      expect(result.content).toBe(unicodeContent);
    });

    it("should handle zero latency", async () => {
      const res = createChatResponse({ latencyMs: 0 });

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const req = createChatRequest();
      const result = await useCase.execute(req);

      expect(result.latencyMs).toBe(0);
    });

    it("should handle large latency", async () => {
      const res = createChatResponse({ latencyMs: 300000 });

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const req = createChatRequest();
      const result = await useCase.execute(req);

      expect(result.latencyMs).toBe(300000);
    });

    it("should handle zero token usage", async () => {
      const res = createChatResponse({
        usage: { inputTokens: 0, outputTokens: 0 },
      });

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const req = createChatRequest();
      const result = await useCase.execute(req);

      expect(result.usage.inputTokens).toBe(0);
      expect(result.usage.outputTokens).toBe(0);
    });

    it("should handle large token usage", async () => {
      const res = createChatResponse({
        usage: { inputTokens: 100000, outputTokens: 50000 },
      });

      vi.mocked(mockGateway.chat).mockResolvedValue(res);

      const req = createChatRequest();
      const result = await useCase.execute(req);

      expect(result.usage.inputTokens).toBe(100000);
      expect(result.usage.outputTokens).toBe(50000);
    });
  });

  describe("concurrent execution", () => {
    it("should handle concurrent requests", async () => {
      const res1 = createChatResponse({ content: "Response 1" });
      const res2 = createChatResponse({ content: "Response 2" });

      vi.mocked(mockGateway.chat)
        .mockResolvedValueOnce(res1)
        .mockResolvedValueOnce(res2);

      const req1 = createChatRequest();
      const req2 = createChatRequest();

      const [result1, result2] = await Promise.all([
        useCase.execute(req1),
        useCase.execute(req2),
      ]);

      expect(result1.content).toBe("Response 1");
      expect(result2.content).toBe("Response 2");
    });

    it("should handle many concurrent requests", async () => {
      const responses = Array.from({ length: 10 }, (_, i) =>
        createChatResponse({ content: `Response ${i + 1}` })
      );

      responses.forEach((res) => {
        vi.mocked(mockGateway.chat).mockResolvedValueOnce(res);
      });

      const requests = Array.from({ length: 10 }, (_, i) =>
        createChatRequest({ messages: [{ role: "user", content: `Q${i + 1}` }] })
      );

      const results = await Promise.all(requests.map((req) => useCase.execute(req)));

      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.content).toBe(`Response ${i + 1}`);
      });
    });
  });

  describe("integration scenarios", () => {
    it("should handle conversation flow", async () => {
      const initialRes = createChatResponse({ content: "Hi, how can I help?" });
      const followupRes = createChatResponse({ content: "Sure, I can help with that" });

      vi.mocked(mockGateway.chat)
        .mockResolvedValueOnce(initialRes)
        .mockResolvedValueOnce(followupRes);

      const initialReq = createChatRequest({
        messages: [{ role: "user", content: "Hello" }],
      });

      const initialResult = await useCase.execute(initialReq);
      expect(initialResult.content).toBe("Hi, how can I help?");

      const followupReq = createChatRequest({
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: initialResult.content },
          { role: "user", content: "Tell me more" },
        ],
      });

      const followupResult = await useCase.execute(followupReq);
      expect(followupResult.content).toBe("Sure, I can help with that");
    });
  });
});
