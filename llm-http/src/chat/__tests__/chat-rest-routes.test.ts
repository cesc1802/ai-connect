import { describe, it, expect, beforeEach, vi } from "vitest";
import { createChatRestRoutes } from "../chat-rest-routes.js";
import type { AppContainer } from "../../container.js";
import type { Request, Response, NextFunction } from "express";
import type { ChatRequest, ChatResponse } from "llm-gateway";

describe("Chat REST Routes", () => {
  let mockContainer: AppContainer;
  let mockRequest: Partial<Request>;
  let mockResponse: any;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockContainer = {
      oneShotChatUseCase: {
        execute: vi.fn(),
      },
    } as unknown as AppContainer;

    mockRequest = {
      body: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  function createMockChatResponse(overrides?: Partial<ChatResponse>): ChatResponse {
    return {
      content: "Sample response",
      finishReason: "stop",
      usage: { inputTokens: 10, outputTokens: 5 },
      latencyMs: 100,
      ...overrides,
    };
  }

  async function callChatRoute(body: any) {
    const router = createChatRestRoutes(mockContainer);
    const mockReq = { body } as Request;
    const mockRes = mockResponse as Response;
    const mockN = vi.fn() as NextFunction;

    const stack = (router as any).stack;
    const postRoute = stack.find((layer: any) => layer.route?.methods?.post);

    if (!postRoute) throw new Error("POST route not found");

    const handlers = postRoute.route.stack || [];
    const handler = handlers[0]?.handle;

    if (!handler) throw new Error("Handler not found");

    await handler(mockReq, mockRes, mockN);

    return { response: mockRes, request: mockReq, next: mockN };
  }

  describe("POST / - route creation", () => {
    it("should create a router with POST endpoint", () => {
      const router = createChatRestRoutes(mockContainer);

      expect(router).toBeDefined();
      const stack = (router as any).stack;
      const postRoute = stack.find((layer: any) => layer.route?.methods?.post);

      expect(postRoute).toBeDefined();
      expect(postRoute.route.path).toBe("/");
    });

    it("should register POST method only", () => {
      const router = createChatRestRoutes(mockContainer);
      const stack = (router as any).stack;
      const postRoute = stack.find((layer: any) => layer.route?.methods?.post);

      expect(postRoute.route.methods.post).toBe(true);
      expect(postRoute.route.methods.get).toBeUndefined();
      expect(postRoute.route.methods.put).toBeUndefined();
      expect(postRoute.route.methods.delete).toBeUndefined();
    });
  });

  describe("POST / - valid request", () => {
    it("should return response when body is valid", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 1000,
      };

      await callChatRoute(body);

      expect(mockResponse.json).toHaveBeenCalledWith(chatResponse);
    });

    it("should accept minimal valid body", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };

      await callChatRoute(body);

      expect(mockResponse.json).toHaveBeenCalledWith(chatResponse);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should use default maxTokens when not provided", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };

      await callChatRoute(body);

      const callArg = vi.mocked(mockContainer.oneShotChatUseCase.execute).mock.calls[0][0];
      expect(callArg.maxTokens).toBe(4096);
    });

    it("should accept custom maxTokens", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 2000,
      };

      await callChatRoute(body);

      const callArg = vi.mocked(mockContainer.oneShotChatUseCase.execute).mock.calls[0][0];
      expect(callArg.maxTokens).toBe(2000);
    });

    it("should accept temperature parameter", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 0.7,
      };

      await callChatRoute(body);

      const callArg = vi.mocked(mockContainer.oneShotChatUseCase.execute).mock.calls[0][0];
      expect(callArg.temperature).toBe(0.7);
    });

    it("should accept multiple messages", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [
          { role: "user", content: "First" },
          { role: "assistant", content: "Response" },
          { role: "user", content: "Second" },
        ],
      };

      await callChatRoute(body);

      const callArg = vi.mocked(mockContainer.oneShotChatUseCase.execute).mock.calls[0][0];
      expect(callArg.messages).toHaveLength(3);
    });

    it("should return response with status code 200", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };

      await callChatRoute(body);

      // Express automatically uses 200 if status is not called
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });

  describe("POST / - invalid request body", () => {
    it("should return 400 when model is missing", async () => {
      const body = {
        messages: [{ role: "user", content: "Hello" }],
      };

      await callChatRoute(body);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "invalid_body",
        })
      );
    });

    it("should return 400 when model is empty string", async () => {
      const body = {
        model: "",
        messages: [{ role: "user", content: "Hello" }],
      };

      await callChatRoute(body);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 when messages is missing", async () => {
      const body = {
        model: "gpt-4",
      };

      await callChatRoute(body);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "invalid_body",
        })
      );
    });

    it("should return 400 when messages is empty array", async () => {
      const body = {
        model: "gpt-4",
        messages: [],
      };

      await callChatRoute(body);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 when messages has invalid role", async () => {
      const body = {
        model: "gpt-4",
        messages: [{ role: "invalid", content: "Hello" }],
      };

      await callChatRoute(body);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("should reject invalid roles (not user/assistant/system)", async () => {
      const invalidRoles = ["bot", "human", "admin", "moderator"];

      for (const role of invalidRoles) {
        vi.clearAllMocks();

        const body = {
          model: "gpt-4",
          messages: [{ role, content: "Hello" }],
        };

        await callChatRoute(body);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
      }
    });

    it("should return 400 when message content is missing", async () => {
      const body = {
        model: "gpt-4",
        messages: [{ role: "user" }],
      };

      await callChatRoute(body);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 when maxTokens is negative", async () => {
      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: -1,
      };

      await callChatRoute(body);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 when maxTokens is zero", async () => {
      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 0,
      };

      await callChatRoute(body);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 when maxTokens exceeds 8192", async () => {
      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 8193,
      };

      await callChatRoute(body);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 when temperature is below 0", async () => {
      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        temperature: -0.1,
      };

      await callChatRoute(body);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 when temperature exceeds 2", async () => {
      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 2.1,
      };

      await callChatRoute(body);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("should accept temperature at boundary 0", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 0,
      };

      await callChatRoute(body);

      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should accept temperature at boundary 2", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 2,
      };

      await callChatRoute(body);

      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should include error details in response", async () => {
      const body = {
        model: "gpt-4",
        messages: [],
      };

      await callChatRoute(body);

      const call = vi.mocked(mockResponse.json).mock.calls[0][0];
      expect(call.message).toBeDefined();
      expect(call.message).toContain("messages");
    });

    it("should reject non-object body", async () => {
      // This test verifies type coercion behavior
      const body = "not an object";

      await callChatRoute(body);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe("POST / - error handling", () => {
    it("should pass errors to next middleware", async () => {
      const error = new Error("Gateway error");

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockRejectedValue(
        error
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };

      const { next } = await callChatRoute(body);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockResponse.json).not.toHaveBeenCalledWith(
        expect.objectContaining({ code: "invalid_body" })
      );
    });

    it("should not catch use case errors", async () => {
      const error = new Error("LLM provider error");

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockRejectedValue(
        error
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };

      const { next } = await callChatRoute(body);

      expect(next).toHaveBeenCalledWith(error);
    });

    it("should handle validation errors separately from execution errors", async () => {
      const body = {
        model: "gpt-4",
        messages: [],
      };

      const { next } = await callChatRoute(body);

      // Validation error should not call next
      expect(next).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe("POST / - response content types", () => {
    it("should return JSON response", async () => {
      const chatResponse = createMockChatResponse({
        content: "Test response",
      });

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };

      await callChatRoute(body);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Test response",
        })
      );
    });

    it("should return full response object", async () => {
      const chatResponse = createMockChatResponse({
        content: "Response",
        finishReason: "stop",
        usage: { inputTokens: 100, outputTokens: 50 },
        latencyMs: 234,
      });

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };

      await callChatRoute(body);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Response",
          finishReason: "stop",
          usage: { inputTokens: 100, outputTokens: 50 },
          latencyMs: 234,
        })
      );
    });

    it("should include tool calls if present", async () => {
      const chatResponse = createMockChatResponse({
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

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };

      await callChatRoute(body);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          toolCalls: expect.any(Array),
        })
      );
    });
  });

  describe("POST / - request passthrough", () => {
    it("should pass all valid fields to use case", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "claude-3-opus",
        messages: [
          { role: "user", content: "Hi" },
          { role: "assistant", content: "Hello" },
        ],
        maxTokens: 2000,
        temperature: 1.5,
      };

      await callChatRoute(body);

      expect(vi.mocked(mockContainer.oneShotChatUseCase.execute)).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-3-opus",
          maxTokens: 2000,
          temperature: 1.5,
        })
      );
    });

    it("should not include extra fields in request", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        extraField: "should be ignored",
        anotherExtra: 123,
      };

      await callChatRoute(body);

      const callArg = vi.mocked(mockContainer.oneShotChatUseCase.execute).mock.calls[0][0];
      expect(callArg).not.toHaveProperty("extraField");
      expect(callArg).not.toHaveProperty("anotherExtra");
    });

    it("should only include temperature if provided", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };

      await callChatRoute(body);

      const callArg = vi.mocked(mockContainer.oneShotChatUseCase.execute).mock.calls[0][0];
      expect(callArg).not.toHaveProperty("temperature");
    });
  });

  describe("POST / - edge cases", () => {
    it("should handle very long model name", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "a".repeat(1000),
        messages: [{ role: "user", content: "Hello" }],
      };

      await callChatRoute(body);

      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it("should handle very long message content", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "a".repeat(100000) }],
      };

      await callChatRoute(body);

      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it("should handle special characters in content", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello\nWorld\t!@#$%^&*()" }],
      };

      await callChatRoute(body);

      expect(mockResponse.json).toHaveBeenCalled();
    });

    it("should handle unicode in model and content", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "claude-3-世界",
        messages: [{ role: "user", content: "Hello 世界 مرحبا 🌍" }],
      };

      await callChatRoute(body);

      expect(mockResponse.json).toHaveBeenCalled();
    });

    it("should accept system message", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a helpful assistant" },
          { role: "user", content: "Hello" },
        ],
      };

      await callChatRoute(body);

      const callArg = vi.mocked(mockContainer.oneShotChatUseCase.execute).mock.calls[0][0];
      expect(callArg.messages).toHaveLength(2);
      expect(callArg.messages[0].role).toBe("system");
    });

    it("should accept maxTokens at boundary 1", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 1,
      };

      await callChatRoute(body);

      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should accept maxTokens at boundary 8192", async () => {
      const chatResponse = createMockChatResponse();

      vi.mocked(mockContainer.oneShotChatUseCase.execute).mockResolvedValue(
        chatResponse
      );

      const body = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 8192,
      };

      await callChatRoute(body);

      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe("POST / - concurrent requests", () => {
    it("should handle concurrent requests independently", async () => {
      const res1 = createMockChatResponse({ content: "Response 1" });
      const res2 = createMockChatResponse({ content: "Response 2" });

      vi.mocked(mockContainer.oneShotChatUseCase.execute)
        .mockResolvedValueOnce(res1)
        .mockResolvedValueOnce(res2);

      const body1 = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Q1" }],
      };

      const body2 = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Q2" }],
      };

      await callChatRoute(body1);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ content: "Response 1" })
      );

      mockResponse.json.mockClear();

      await callChatRoute(body2);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ content: "Response 2" })
      );
    });
  });
});
