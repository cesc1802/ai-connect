import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MiniMaxProvider } from "./minimax-provider.js";
import { AuthenticationError, RateLimitError } from "../core/index.js";

describe("MiniMaxProvider", () => {
  let provider: MiniMaxProvider;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    provider = new MiniMaxProvider({
      apiKey: "test-api-key",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("uses default baseUrl and model", () => {
      expect(provider.name).toBe("minimax");
      expect(provider.models).toContain("MiniMax-M2.7");
    });

    it("accepts custom baseUrl", () => {
      const p = new MiniMaxProvider({
        apiKey: "key",
        baseUrl: "https://custom.api.com",
      });
      expect(p.name).toBe("minimax");
    });
  });

  describe("capabilities", () => {
    it("returns correct capabilities", () => {
      const caps = provider.capabilities();
      expect(caps.streaming).toBe(true);
      expect(caps.tools).toBe(false);
      expect(caps.vision).toBe(false);
      expect(caps.jsonMode).toBe(false);
      expect(caps.maxContextTokens).toBe(245_760);
    });
  });

  describe("chatCompletion", () => {
    it("returns normalized response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "response-123",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: { role: "assistant", content: "Hello from MiniMax!" },
            },
          ],
          usage: {
            prompt_tokens: 15,
            completion_tokens: 8,
            total_tokens: 23,
          },
          model: "MiniMax-M2.7",
        }),
      });

      const response = await provider.chatCompletion({
        model: "MiniMax-M2.7",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 100,
      });

      expect(response.id).toBe("response-123");
      expect(response.content).toBe("Hello from MiniMax!");
      expect(response.model).toBe("MiniMax-M2.7");
      expect(response.usage.inputTokens).toBe(15);
      expect(response.usage.outputTokens).toBe(8);
      expect(response.finishReason).toBe("stop");
    });

    it("sends correct headers with authorization", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "123",
          choices: [{ index: 0, finish_reason: "stop", message: { content: "Hi" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          model: "MiniMax-M2.7",
        }),
      });

      await provider.chatCompletion({
        model: "MiniMax-M2.7",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 100,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/text/chatcompletion_v2"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key",
          }),
        })
      );
    });

    it("throws AuthenticationError on 401", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Invalid API key",
      });

      await expect(
        provider.chatCompletion({
          model: "MiniMax-M2.7",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it("throws RateLimitError on 429", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "Rate limit exceeded",
      });

      await expect(
        provider.chatCompletion({
          model: "MiniMax-M2.7",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        })
      ).rejects.toThrow(RateLimitError);
    });

    it("throws ProviderError on no choices", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "123",
          choices: [],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          model: "MiniMax-M2.7",
        }),
      });

      await expect(
        provider.chatCompletion({
          model: "MiniMax-M2.7",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        })
      ).rejects.toThrow("No response choices returned");
    });
  });

  describe("streamCompletion", () => {
    it("yields stream chunks from SSE format", async () => {
      const encoder = new TextEncoder();
      const chunks = [
        'data: {"id":"123","choices":[{"index":0,"delta":{"content":"Hello"}}]}\n\n',
        'data: {"id":"123","choices":[{"index":0,"delta":{"content":" world"}}]}\n\n',
        'data: {"id":"123","choices":[{"index":0,"finish_reason":"stop","delta":{}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n',
        "data: [DONE]\n\n",
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
        headers: new Headers({ "content-type": "text/event-stream" }),
        body: { getReader: () => mockReader },
      });

      const results: unknown[] = [];
      for await (const chunk of provider.streamCompletion({
        model: "MiniMax-M2.7",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 100,
      })) {
        results.push(chunk);
      }

      expect(results.length).toBeGreaterThanOrEqual(3);
      expect(results[0]).toMatchObject({ delta: { type: "text", text: "Hello" } });
      expect(results[1]).toMatchObject({ delta: { type: "text", text: " world" } });
    });

    it("throws ProviderError when no response body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "text/event-stream" }),
        body: null,
      });

      const gen = provider.streamCompletion({
        model: "MiniMax-M2.7",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 100,
      });

      await expect(async () => {
        for await (const chunk of gen) {
          void chunk;
        }
      }).rejects.toThrow("No response body");
    });

    it("throws AuthenticationError on JSON error response", async () => {
      // MiniMax returns JSON (not SSE) with HTTP 200 for authentication errors
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            base_resp: {
              status_code: 1004,
              status_msg: "login fail: Please carry the API secret key",
            },
          }),
      });

      const gen = provider.streamCompletion({
        model: "MiniMax-M2.7",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 100,
      });

      await expect(async () => {
        for await (const chunk of gen) {
          void chunk;
        }
      }).rejects.toThrow(AuthenticationError);
    });
  });

  describe("role mapping", () => {
    it("maps tool role to user", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "123",
          choices: [{ index: 0, finish_reason: "stop", message: { content: "OK" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          model: "MiniMax-M2.7",
        }),
      });

      await provider.chatCompletion({
        model: "MiniMax-M2.7",
        messages: [
          { role: "user", content: "Call tool" },
          { role: "tool", content: "Tool result", toolCallId: "tc-1" },
        ],
        maxTokens: 100,
      });

      const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
      expect(body.messages[1].role).toBe("user");
    });
  });

  describe("supportsModel", () => {
    it("supports listed models", () => {
      expect(provider.supportsModel("MiniMax-M2.7")).toBe(true);
      expect(provider.supportsModel("MiniMax-M2.5")).toBe(true);
    });

    it("does not support unknown models", () => {
      expect(provider.supportsModel("gpt-4")).toBe(false);
      expect(provider.supportsModel("unknown")).toBe(false);
    });
  });
});
