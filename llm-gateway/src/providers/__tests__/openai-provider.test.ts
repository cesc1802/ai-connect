import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import OpenAI from "openai";
import type { ChatRequest } from "../../core/index.js";
import {
  AuthenticationError,
  RateLimitError,
  ModelNotFoundError,
  ProviderError,
  ContentFilterError,
  ValidationError,
} from "../../core/index.js";
import { OpenAIProvider } from "../openai-provider.js";
import { ProviderFactory } from "../../factory/index.js";

// Mock the OpenAI SDK
vi.mock("openai", () => {
  class APIError extends Error {
    status: number;
    headers: Record<string, string>;
    constructor(
      status: number,
      _error: unknown,
      message: string,
      headers: Record<string, string>
    ) {
      super(message);
      this.status = status;
      this.headers = headers;
      this.name = "APIError";
    }
  }

  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  }));

  (MockOpenAI as unknown as { APIError: typeof APIError }).APIError = APIError;
  return { default: MockOpenAI };
});

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;
  let mockClient: { chat: { completions: { create: Mock } } };

  const validRequest: ChatRequest = {
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello" }],
    maxTokens: 100,
  };

  const mockResponse: OpenAI.ChatCompletion = {
    id: "chatcmpl-123",
    object: "chat.completion",
    created: 1234567890,
    model: "gpt-4o",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "Hello there!",
          refusal: null,
        },
        finish_reason: "stop",
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIProvider({ apiKey: "test-key" });
    mockClient = (provider as unknown as { client: typeof mockClient }).client;
  });

  describe("constructor", () => {
    it("should create provider with required config", () => {
      const p = new OpenAIProvider({ apiKey: "test-key" });
      expect(p.name).toBe("openai");
    });

    it("should use custom baseUrl if provided", () => {
      new OpenAIProvider({
        apiKey: "test-key",
        baseUrl: "https://custom.api.com",
      });
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: "test-key",
        organization: undefined,
        baseURL: "https://custom.api.com",
      });
    });

    it("should pass organization if provided", () => {
      new OpenAIProvider({
        apiKey: "test-key",
        organization: "org-123",
      });
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: "test-key",
        organization: "org-123",
        baseURL: undefined,
      });
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const caps = provider.capabilities();
      expect(caps.streaming).toBe(true);
      expect(caps.tools).toBe(true);
      expect(caps.vision).toBe(true);
      expect(caps.jsonMode).toBe(true);
      expect(caps.maxContextTokens).toBe(128_000);
    });
  });

  describe("supportsModel", () => {
    it("should support GPT-4o models", () => {
      expect(provider.supportsModel("gpt-4o")).toBe(true);
      expect(provider.supportsModel("gpt-4o-2024-08-06")).toBe(true);
      expect(provider.supportsModel("gpt-4o-mini")).toBe(true);
      expect(provider.supportsModel("gpt-4o-mini-2024-07-18")).toBe(true);
    });

    it("should support GPT-4 turbo models", () => {
      expect(provider.supportsModel("gpt-4-turbo")).toBe(true);
      expect(provider.supportsModel("gpt-4-turbo-2024-04-09")).toBe(true);
    });

    it("should support GPT-4 models", () => {
      expect(provider.supportsModel("gpt-4")).toBe(true);
      expect(provider.supportsModel("gpt-4-0613")).toBe(true);
    });

    it("should support GPT-3.5 turbo models", () => {
      expect(provider.supportsModel("gpt-3.5-turbo")).toBe(true);
      expect(provider.supportsModel("gpt-3.5-turbo-0125")).toBe(true);
    });

    it("should support o1 and o3-mini models", () => {
      expect(provider.supportsModel("o1")).toBe(true);
      expect(provider.supportsModel("o1-preview")).toBe(true);
      expect(provider.supportsModel("o3-mini")).toBe(true);
      expect(provider.supportsModel("o3-mini-2025-01-31")).toBe(true);
    });

    it("should not support unknown models", () => {
      expect(provider.supportsModel("claude-3-opus")).toBe(false);
      expect(provider.supportsModel("unknown")).toBe(false);
    });
  });

  describe("chatCompletion", () => {
    it("should return normalized response", async () => {
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await provider.chatCompletion(validRequest);

      expect(result.id).toBe("chatcmpl-123");
      expect(result.content).toBe("Hello there!");
      expect(result.model).toBe("gpt-4o");
      expect(result.finishReason).toBe("stop");
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(5);
      expect(result.usage.totalTokens).toBe(15);
      expect(result.toolCalls).toEqual([]);
    });

    it("should pass system message correctly", async () => {
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.chatCompletion({
        ...validRequest,
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "Hello" },
        ],
      });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: "system", content: "You are helpful" },
            { role: "user", content: "Hello" },
          ],
        }),
        expect.anything()
      );
    });

    it("should handle tool calls in response", async () => {
      const responseWithTools: OpenAI.ChatCompletion = {
        ...mockResponse,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Let me help",
              refusal: null,
              tool_calls: [
                {
                  id: "call_123",
                  type: "function",
                  function: {
                    name: "get_weather",
                    arguments: '{"location":"Tokyo"}',
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
            logprobs: null,
          },
        ],
      };
      mockClient.chat.completions.create.mockResolvedValue(responseWithTools);

      const result = await provider.chatCompletion(validRequest);

      expect(result.finishReason).toBe("tool_calls");
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]).toEqual({
        id: "call_123",
        type: "function",
        function: {
          name: "get_weather",
          arguments: '{"location":"Tokyo"}',
        },
      });
    });

    it("should map tool definitions correctly", async () => {
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.chatCompletion({
        ...validRequest,
        tools: [
          {
            type: "function",
            function: {
              name: "get_weather",
              description: "Get weather info",
              parameters: {
                type: "object",
                properties: { location: { type: "string" } },
              },
            },
          },
        ],
        toolChoice: "auto",
      });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [
            {
              type: "function",
              function: {
                name: "get_weather",
                description: "Get weather info",
                parameters: {
                  type: "object",
                  properties: { location: { type: "string" } },
                },
              },
            },
          ],
          tool_choice: "auto",
        }),
        expect.anything()
      );
    });

    it("should handle vision input with base64", async () => {
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.chatCompletion({
        ...validRequest,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What's in this image?" },
              {
                type: "image",
                source: {
                  type: "base64",
                  mediaType: "image/png",
                  data: "base64data",
                },
              },
            ],
          },
        ],
      });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "What's in this image?" },
                {
                  type: "image_url",
                  image_url: { url: "data:image/png;base64,base64data" },
                },
              ],
            },
          ],
        }),
        expect.anything()
      );
    });

    it("should handle vision input with URL", async () => {
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.chatCompletion({
        ...validRequest,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What's in this image?" },
              {
                type: "image",
                source: {
                  type: "url",
                  mediaType: "image/png",
                  data: "https://example.com/image.png",
                },
              },
            ],
          },
        ],
      });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "What's in this image?" },
                {
                  type: "image_url",
                  image_url: { url: "https://example.com/image.png" },
                },
              ],
            },
          ],
        }),
        expect.anything()
      );
    });

    it("should handle tool results", async () => {
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.chatCompletion({
        ...validRequest,
        messages: [
          { role: "user", content: "Get weather" },
          { role: "assistant", content: "Using weather tool" },
          {
            role: "tool",
            content: '{"temp": 20}',
            toolCallId: "call_123",
          },
        ],
      });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            {
              role: "tool",
              tool_call_id: "call_123",
              content: '{"temp": 20}',
            },
          ]),
        }),
        expect.anything()
      );
    });

    it("should throw ValidationError for tool message without toolCallId", async () => {
      await expect(
        provider.chatCompletion({
          ...validRequest,
          messages: [
            { role: "user", content: "Hello" },
            { role: "tool", content: "result" }, // Missing toolCallId
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should use JSON mode with response_format", async () => {
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.chatCompletion({
        ...validRequest,
        responseFormat: { type: "json_object" },
      });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: { type: "json_object" },
        }),
        expect.anything()
      );
    });

    it("should use JSON schema mode", async () => {
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.chatCompletion({
        ...validRequest,
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            type: "object",
            properties: { name: { type: "string" } },
          },
        },
      });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "response",
              schema: {
                type: "object",
                properties: { name: { type: "string" } },
              },
            },
          },
        }),
        expect.anything()
      );
    });

    it("should pass abort signal to SDK", async () => {
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);
      const controller = new AbortController();

      await provider.chatCompletion(validRequest, controller.signal);

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.anything(),
        { signal: controller.signal }
      );
    });
  });

  describe("streamCompletion", () => {
    it("should yield text chunks", async () => {
      const mockChunks = [
        {
          id: "chatcmpl-123",
          choices: [{ index: 0, delta: { content: "Hello" }, finish_reason: null }],
        },
        {
          id: "chatcmpl-123",
          choices: [{ index: 0, delta: { content: " there" }, finish_reason: null }],
        },
        {
          id: "chatcmpl-123",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      ];

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockChunks) {
            yield chunk;
          }
        },
      };
      mockClient.chat.completions.create.mockResolvedValue(mockStream);

      const chunks: unknown[] = [];
      for await (const chunk of provider.streamCompletion(validRequest)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toMatchObject({
        delta: { type: "text", text: "Hello" },
      });
      expect(chunks[1]).toMatchObject({
        delta: { type: "text", text: " there" },
      });
      expect(chunks[2]).toMatchObject({
        finishReason: "stop",
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });
    });

    it("should yield tool call chunks", async () => {
      const mockChunks = [
        {
          id: "chatcmpl-123",
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_123",
                    function: { name: "get_weather", arguments: "" },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          id: "chatcmpl-123",
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: '{"loc' },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          id: "chatcmpl-123",
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: 'ation":"Tokyo"}' },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          id: "chatcmpl-123",
          choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      ];

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockChunks) {
            yield chunk;
          }
        },
      };
      mockClient.chat.completions.create.mockResolvedValue(mockStream);

      const chunks: unknown[] = [];
      for await (const chunk of provider.streamCompletion(validRequest)) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toMatchObject({
        delta: {
          type: "tool_call_start",
          toolCall: {
            id: "call_123",
            type: "function",
            function: { name: "get_weather", arguments: "" },
          },
        },
      });
      expect(chunks[1]).toMatchObject({
        delta: {
          type: "tool_call_delta",
          toolCallId: "call_123",
          arguments: '{"loc',
        },
      });
      expect(chunks[2]).toMatchObject({
        delta: {
          type: "tool_call_delta",
          toolCallId: "call_123",
          arguments: 'ation":"Tokyo"}',
        },
      });
    });

    it("should request stream with include_usage", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: "chatcmpl-123",
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          };
        },
      };
      mockClient.chat.completions.create.mockResolvedValue(mockStream);

      const chunks: unknown[] = [];
      for await (const chunk of provider.streamCompletion(validRequest)) {
        chunks.push(chunk);
      }

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true,
          stream_options: { include_usage: true },
        }),
        expect.anything()
      );
    });
  });

  describe("error mapping", () => {
    const APIError = OpenAI.APIError as unknown as new (
      status: number,
      error: unknown,
      message: string,
      headers: Record<string, string>
    ) => Error & { status: number; headers: Record<string, string> };

    it("should map 401 to AuthenticationError", async () => {
      const error = new APIError(401, {}, "Invalid API key", {});
      mockClient.chat.completions.create.mockRejectedValue(error);

      await expect(provider.chatCompletion(validRequest)).rejects.toThrow(
        AuthenticationError
      );
    });

    it("should map 429 to RateLimitError", async () => {
      const error = new APIError(429, {}, "Rate limited", {
        "retry-after": "30",
      });
      mockClient.chat.completions.create.mockRejectedValue(error);

      await expect(provider.chatCompletion(validRequest)).rejects.toThrow(
        RateLimitError
      );
    });

    it("should map 404 to ModelNotFoundError", async () => {
      const error = new APIError(404, {}, "Model not found", {});
      mockClient.chat.completions.create.mockRejectedValue(error);

      await expect(provider.chatCompletion(validRequest)).rejects.toThrow(
        ModelNotFoundError
      );
    });

    it("should map content_filter message to ContentFilterError", async () => {
      const error = new APIError(
        400,
        {},
        "This request triggered content_filter",
        {}
      );
      mockClient.chat.completions.create.mockRejectedValue(error);

      await expect(provider.chatCompletion(validRequest)).rejects.toThrow(
        ContentFilterError
      );
    });

    it("should map other API errors to ProviderError", async () => {
      const error = new APIError(500, {}, "Internal error", {});
      mockClient.chat.completions.create.mockRejectedValue(error);

      await expect(provider.chatCompletion(validRequest)).rejects.toThrow(
        ProviderError
      );
    });

    it("should wrap non-API errors in ProviderError", async () => {
      mockClient.chat.completions.create.mockRejectedValue(
        new Error("Network error")
      );

      await expect(provider.chatCompletion(validRequest)).rejects.toThrow(
        ProviderError
      );
    });
  });

  describe("tool choice mapping", () => {
    beforeEach(() => {
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);
    });

    it("should map 'auto' to 'auto'", async () => {
      await provider.chatCompletion({ ...validRequest, toolChoice: "auto" });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ tool_choice: "auto" }),
        expect.anything()
      );
    });

    it("should map 'none' to 'none'", async () => {
      await provider.chatCompletion({ ...validRequest, toolChoice: "none" });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ tool_choice: "none" }),
        expect.anything()
      );
    });

    it("should map 'required' to 'required'", async () => {
      await provider.chatCompletion({
        ...validRequest,
        toolChoice: "required",
      });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ tool_choice: "required" }),
        expect.anything()
      );
    });

    it("should map specific function to { type: 'function', function: { name } }", async () => {
      await provider.chatCompletion({
        ...validRequest,
        toolChoice: { type: "function", function: { name: "my_tool" } },
      });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tool_choice: { type: "function", function: { name: "my_tool" } },
        }),
        expect.anything()
      );
    });
  });

  describe("finish reason mapping", () => {
    it("should map 'stop' to 'stop'", async () => {
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);
      const result = await provider.chatCompletion(validRequest);
      expect(result.finishReason).toBe("stop");
    });

    it("should map 'length' to 'length'", async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        ...mockResponse,
        choices: [{ ...mockResponse.choices[0], finish_reason: "length" }],
      });
      const result = await provider.chatCompletion(validRequest);
      expect(result.finishReason).toBe("length");
    });

    it("should map 'tool_calls' to 'tool_calls'", async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        ...mockResponse,
        choices: [{ ...mockResponse.choices[0], finish_reason: "tool_calls" }],
      });
      const result = await provider.chatCompletion(validRequest);
      expect(result.finishReason).toBe("tool_calls");
    });

    it("should map 'content_filter' to 'content_filter'", async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        ...mockResponse,
        choices: [
          { ...mockResponse.choices[0], finish_reason: "content_filter" },
        ],
      });
      const result = await provider.chatCompletion(validRequest);
      expect(result.finishReason).toBe("content_filter");
    });
  });

  describe("factory registration", () => {
    it("should be registered with ProviderFactory", () => {
      expect(ProviderFactory.isRegistered("openai")).toBe(true);
    });

    it("should be creatable via factory", () => {
      const factory = new ProviderFactory({
        openai: { apiKey: "test-key" },
      });
      const p = factory.create("openai");
      expect(p).toBeInstanceOf(OpenAIProvider);
    });
  });
});
