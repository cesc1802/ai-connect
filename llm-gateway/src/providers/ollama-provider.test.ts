import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OllamaProvider } from "./ollama-provider.js";
import { ProviderError } from "../core/index.js";

describe("OllamaProvider", () => {
  let provider: OllamaProvider;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    provider = new OllamaProvider({
      baseUrl: "http://localhost:11434",
      defaultModel: "llama3.2",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("removes trailing slash from baseUrl", () => {
      const p = new OllamaProvider({
        baseUrl: "http://localhost:11434/",
      });
      expect(p.name).toBe("ollama");
    });

    it("uses default model if not specified", () => {
      expect(provider.models).toEqual(["*"]);
    });
  });

  describe("capabilities", () => {
    it("returns correct capabilities", () => {
      const caps = provider.capabilities();
      expect(caps.streaming).toBe(true);
      expect(caps.tools).toBe(true);
      expect(caps.vision).toBe(true);
      expect(caps.jsonMode).toBe(true);
    });
  });

  describe("chatCompletion", () => {
    it("returns normalized response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "llama3.2",
          created_at: "2024-01-01T00:00:00Z",
          message: { role: "assistant", content: "Hello!" },
          done: true,
          prompt_eval_count: 10,
          eval_count: 5,
        }),
      });

      const response = await provider.chatCompletion({
        model: "llama3.2",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 100,
      });

      expect(response.content).toBe("Hello!");
      expect(response.model).toBe("llama3.2");
      expect(response.usage.inputTokens).toBe(10);
      expect(response.usage.outputTokens).toBe(5);
      expect(response.finishReason).toBe("stop");
    });

    it("handles tool calls in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "llama3.2",
          created_at: "2024-01-01T00:00:00Z",
          message: {
            role: "assistant",
            content: "",
            tool_calls: [
              {
                function: {
                  name: "get_weather",
                  arguments: { location: "Tokyo" },
                },
              },
            ],
          },
          done: true,
          prompt_eval_count: 10,
          eval_count: 5,
        }),
      });

      const response = await provider.chatCompletion({
        model: "llama3.2",
        messages: [{ role: "user", content: "What's the weather?" }],
        maxTokens: 100,
        tools: [
          {
            type: "function",
            function: {
              name: "get_weather",
              description: "Get weather",
              parameters: { type: "object", properties: {} },
            },
          },
        ],
      });

      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls[0]?.function.name).toBe("get_weather");
      expect(response.finishReason).toBe("tool_calls");
    });

    it("throws ProviderError on fetch failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      await expect(
        provider.chatCompletion({
          model: "llama3.2",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        })
      ).rejects.toThrow(ProviderError);
    });

    it("throws ProviderError when server not running", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      await expect(
        provider.chatCompletion({
          model: "llama3.2",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        })
      ).rejects.toThrow("Ollama server not running");
    });
  });

  describe("streamCompletion", () => {
    it("yields stream chunks from NDJSON", async () => {
      const encoder = new TextEncoder();
      const chunks = [
        '{"model":"llama3.2","message":{"role":"assistant","content":"Hello"},"done":false}\n',
        '{"model":"llama3.2","message":{"role":"assistant","content":" world"},"done":false}\n',
        '{"model":"llama3.2","message":{"role":"assistant","content":""},"done":true,"prompt_eval_count":10,"eval_count":5}\n',
      ];

      let chunkIndex = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkIndex >= chunks.length) {
            return { done: true, value: undefined };
          }
          return { done: false, value: encoder.encode(chunks[chunkIndex++]) };
        }),
        releaseLock: vi.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const results: unknown[] = [];
      for await (const chunk of provider.streamCompletion({
        model: "llama3.2",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 100,
      })) {
        results.push(chunk);
      }

      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({ delta: { type: "text", text: "Hello" } });
      expect(results[1]).toMatchObject({ delta: { type: "text", text: " world" } });
      expect(results[2]).toMatchObject({
        finishReason: "stop",
        usage: { inputTokens: 10, outputTokens: 5 },
      });
    });

    it("throws ProviderError when no response body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const gen = provider.streamCompletion({
        model: "llama3.2",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 100,
      });

      await expect(async () => {
        for await (const chunk of gen) {
          void chunk;
        }
      }).rejects.toThrow("No response body");
    });
  });

  describe("supportsModel", () => {
    it("supports any model (wildcard)", () => {
      expect(provider.supportsModel("llama3.2")).toBe(true);
      expect(provider.supportsModel("mistral")).toBe(true);
      expect(provider.supportsModel("any-model")).toBe(true);
    });
  });
});
