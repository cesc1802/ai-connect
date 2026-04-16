import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import type { ChatRequest } from "../../core/index.js";
import {
  AuthenticationError,
  RateLimitError,
  ModelNotFoundError,
  ProviderError,
  ValidationError,
} from "../../core/index.js";
import { AnthropicProvider } from "../anthropic-provider.js";
import { ProviderFactory } from "../../factory/index.js";

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  // Create APIError inside the factory
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

  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
      stream: vi.fn(),
    },
  }));

  (MockAnthropic as unknown as { APIError: typeof APIError }).APIError = APIError;
  return { default: MockAnthropic };
});

describe("AnthropicProvider", () => {
  let provider: AnthropicProvider;
  let mockClient: { messages: { create: Mock; stream: Mock } };

  const validRequest: ChatRequest = {
    model: "claude-sonnet-4-20250514",
    messages: [{ role: "user", content: "Hello" }],
    maxTokens: 100,
  };

  const mockResponse: Anthropic.Message = {
    id: "msg_123",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: "Hello there!" }],
    model: "claude-sonnet-4-20250514",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new AnthropicProvider({ apiKey: "test-key" });
    // Get reference to mock client
    mockClient = (provider as unknown as { client: typeof mockClient }).client;
  });

  describe("constructor", () => {
    it("should create provider with required config", () => {
      const p = new AnthropicProvider({ apiKey: "test-key" });
      expect(p.name).toBe("anthropic");
    });

    it("should use custom baseUrl if provided", () => {
      new AnthropicProvider({
        apiKey: "test-key",
        baseUrl: "https://custom.api.com",
      });
      expect(Anthropic).toHaveBeenCalledWith({
        apiKey: "test-key",
        baseURL: "https://custom.api.com",
      });
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const caps = provider.capabilities();
      expect(caps.streaming).toBe(true);
      expect(caps.tools).toBe(true);
      expect(caps.vision).toBe(true);
      expect(caps.jsonMode).toBe(false);
      expect(caps.maxContextTokens).toBe(200_000);
    });
  });

  describe("supportsModel", () => {
    it("should support Claude 3.5 models", () => {
      expect(provider.supportsModel("claude-3-5-sonnet-20240620")).toBe(true);
      expect(provider.supportsModel("claude-3-5-haiku-20241022")).toBe(true);
    });

    it("should support Claude 3 models", () => {
      expect(provider.supportsModel("claude-3-opus-20240229")).toBe(true);
      expect(provider.supportsModel("claude-3-sonnet-20240229")).toBe(true);
      expect(provider.supportsModel("claude-3-haiku-20240307")).toBe(true);
    });

    it("should support Claude 4 models", () => {
      expect(provider.supportsModel("claude-sonnet-4-20250514")).toBe(true);
      expect(provider.supportsModel("claude-opus-4-20250514")).toBe(true);
    });

    it("should not support unknown models", () => {
      expect(provider.supportsModel("gpt-4")).toBe(false);
      expect(provider.supportsModel("unknown")).toBe(false);
    });
  });

  describe("chatCompletion", () => {
    it("should return normalized response", async () => {
      mockClient.messages.create.mockResolvedValue(mockResponse);

      const result = await provider.chatCompletion(validRequest);

      expect(result.id).toBe("msg_123");
      expect(result.content).toBe("Hello there!");
      expect(result.model).toBe("claude-sonnet-4-20250514");
      expect(result.finishReason).toBe("stop");
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(5);
      expect(result.usage.totalTokens).toBe(15);
      expect(result.toolCalls).toEqual([]);
    });

    it("should extract system message", async () => {
      mockClient.messages.create.mockResolvedValue(mockResponse);

      await provider.chatCompletion({
        ...validRequest,
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "Hello" },
        ],
      });

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: "You are helpful",
          messages: [{ role: "user", content: "Hello" }],
        }),
        expect.anything()
      );
    });

    it("should handle tool calls in response", async () => {
      const responseWithTools: Anthropic.Message = {
        ...mockResponse,
        stop_reason: "tool_use",
        content: [
          { type: "text", text: "Let me help" },
          {
            type: "tool_use",
            id: "tool_123",
            name: "get_weather",
            input: { location: "Tokyo" },
          },
        ],
      };
      mockClient.messages.create.mockResolvedValue(responseWithTools);

      const result = await provider.chatCompletion(validRequest);

      expect(result.finishReason).toBe("tool_calls");
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]).toEqual({
        id: "tool_123",
        type: "function",
        function: {
          name: "get_weather",
          arguments: '{"location":"Tokyo"}',
        },
      });
    });

    it("should map tool definitions correctly", async () => {
      mockClient.messages.create.mockResolvedValue(mockResponse);

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

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [
            {
              name: "get_weather",
              description: "Get weather info",
              input_schema: {
                type: "object",
                properties: { location: { type: "string" } },
              },
            },
          ],
          tool_choice: { type: "auto" },
        }),
        expect.anything()
      );
    });

    it("should handle vision input", async () => {
      mockClient.messages.create.mockResolvedValue(mockResponse);

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

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "What's in this image?" },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: "base64data",
                  },
                },
              ],
            },
          ],
        }),
        expect.anything()
      );
    });

    it("should handle tool results", async () => {
      mockClient.messages.create.mockResolvedValue(mockResponse);

      await provider.chatCompletion({
        ...validRequest,
        messages: [
          { role: "user", content: "Get weather" },
          {
            role: "assistant",
            content: "Using weather tool",
          },
          {
            role: "tool",
            content: '{"temp": 20}',
            toolCallId: "tool_123",
          },
        ],
      });

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: "tool_123",
                  content: '{"temp": 20}',
                },
              ],
            },
          ]),
        }),
        expect.anything()
      );
    });

    it("should pass abort signal to SDK", async () => {
      mockClient.messages.create.mockResolvedValue(mockResponse);
      const controller = new AbortController();

      await provider.chatCompletion(validRequest, controller.signal);

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.anything(),
        { signal: controller.signal }
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

    it("should throw ValidationError for URL image source", async () => {
      await expect(
        provider.chatCompletion({
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
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("streamCompletion", () => {
    it("should yield text chunks", async () => {
      const mockStreamEvents = [
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hello" },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: " there" },
        },
        { type: "message_stop" },
      ];

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const event of mockStreamEvents) {
            yield event;
          }
        },
        finalMessage: vi.fn().mockResolvedValue({
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      };
      mockClient.messages.stream.mockReturnValue(mockStream);

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
      const mockStreamEvents = [
        {
          type: "content_block_start",
          index: 0,
          content_block: {
            type: "tool_use",
            id: "tool_123",
            name: "get_weather",
          },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "input_json_delta", partial_json: '{"loc' },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "input_json_delta", partial_json: 'ation":"Tokyo"}' },
        },
        { type: "message_stop" },
      ];

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const event of mockStreamEvents) {
            yield event;
          }
        },
        finalMessage: vi.fn().mockResolvedValue({
          stop_reason: "tool_use",
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      };
      mockClient.messages.stream.mockReturnValue(mockStream);

      const chunks: unknown[] = [];
      for await (const chunk of provider.streamCompletion(validRequest)) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toMatchObject({
        delta: {
          type: "tool_call_start",
          toolCall: {
            id: "tool_123",
            type: "function",
            function: { name: "get_weather", arguments: "" },
          },
        },
      });
      expect(chunks[1]).toMatchObject({
        delta: {
          type: "tool_call_delta",
          toolCallId: "tool_123",
          arguments: '{"loc',
        },
      });
    });
  });

  describe("error mapping", () => {
    // Get APIError from the mocked Anthropic module
    const APIError = Anthropic.APIError as unknown as new (
      status: number,
      error: unknown,
      message: string,
      headers: Record<string, string>
    ) => Error & { status: number; headers: Record<string, string> };

    it("should map 401 to AuthenticationError", async () => {
      const error = new APIError(401, {}, "Invalid API key", {});
      mockClient.messages.create.mockRejectedValue(error);

      await expect(provider.chatCompletion(validRequest)).rejects.toThrow(
        AuthenticationError
      );
    });

    it("should map 429 to RateLimitError", async () => {
      const error = new APIError(429, {}, "Rate limited", {
        "retry-after": "30",
      });
      mockClient.messages.create.mockRejectedValue(error);

      await expect(provider.chatCompletion(validRequest)).rejects.toThrow(
        RateLimitError
      );
    });

    it("should map 404 to ModelNotFoundError", async () => {
      const error = new APIError(404, {}, "Model not found", {});
      mockClient.messages.create.mockRejectedValue(error);

      await expect(provider.chatCompletion(validRequest)).rejects.toThrow(
        ModelNotFoundError
      );
    });

    it("should map other API errors to ProviderError", async () => {
      const error = new APIError(500, {}, "Internal error", {});
      mockClient.messages.create.mockRejectedValue(error);

      await expect(provider.chatCompletion(validRequest)).rejects.toThrow(
        ProviderError
      );
    });

    it("should wrap non-API errors in ProviderError", async () => {
      mockClient.messages.create.mockRejectedValue(new Error("Network error"));

      await expect(provider.chatCompletion(validRequest)).rejects.toThrow(
        ProviderError
      );
    });
  });

  describe("tool choice mapping", () => {
    beforeEach(() => {
      mockClient.messages.create.mockResolvedValue(mockResponse);
    });

    it("should map 'auto' to { type: 'auto' }", async () => {
      await provider.chatCompletion({ ...validRequest, toolChoice: "auto" });

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({ tool_choice: { type: "auto" } }),
        expect.anything()
      );
    });

    it("should map 'required' to { type: 'any' }", async () => {
      await provider.chatCompletion({
        ...validRequest,
        toolChoice: "required",
      });

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({ tool_choice: { type: "any" } }),
        expect.anything()
      );
    });

    it("should map specific function to { type: 'tool', name }", async () => {
      await provider.chatCompletion({
        ...validRequest,
        toolChoice: { type: "function", function: { name: "my_tool" } },
      });

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tool_choice: { type: "tool", name: "my_tool" },
        }),
        expect.anything()
      );
    });

    it("should not set tool_choice for 'none'", async () => {
      await provider.chatCompletion({ ...validRequest, toolChoice: "none" });

      const callArgs = mockClient.messages.create.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expect(callArgs?.tool_choice).toBeUndefined();
    });
  });

  describe("factory registration", () => {
    it("should be registered with ProviderFactory", () => {
      expect(ProviderFactory.isRegistered("anthropic")).toBe(true);
    });

    it("should be creatable via factory", () => {
      const factory = new ProviderFactory({
        anthropic: { apiKey: "test-key" },
      });
      const p = factory.create("anthropic");
      expect(p).toBeInstanceOf(AnthropicProvider);
    });
  });
});
