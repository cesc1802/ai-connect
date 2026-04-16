import { describe, it, expect } from "vitest";
import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities,
  ProviderName,
} from "../../core/index.js";
import { ValidationError, AbortError } from "../../core/index.js";
import { BaseProvider } from "../base-provider.js";
import { isLLMProvider } from "../llm-provider.js";

// Concrete implementation for testing
class TestProvider extends BaseProvider {
  readonly name: ProviderName = "anthropic";
  readonly models = ["model-1", "model-2", "model-prefix-*"];

  capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tools: true,
      vision: false,
      jsonMode: true,
      maxContextTokens: 100000,
    };
  }

  async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
    this.validateRequest(request);
    const requestId = this.generateRequestId();
    this.startTiming(requestId);
    const latency = this.getLatency(requestId);
    return {
      id: requestId,
      content: "test response",
      toolCalls: [],
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      model: request.model,
      finishReason: "stop",
      latencyMs: latency,
    };
  }

  async *streamCompletion(request: ChatRequest): AsyncIterable<StreamChunk> {
    this.validateRequest(request);
    yield {
      id: "chunk-1",
      delta: { type: "text", text: "test" },
    };
  }

  // Expose protected methods for testing
  public testValidateRequest(request: ChatRequest): void {
    this.validateRequest(request);
  }

  public testCheckAbort(signal?: AbortSignal): void {
    this.checkAbort(signal);
  }

  public testGetTextContent(message: { role: "user"; content: string | { type: "text"; text: string }[] }): string {
    return this.getTextContent(message);
  }

  public testHasImages(message: { role: "user"; content: string | { type: "image"; source: { type: "base64"; mediaType: "image/png"; data: string } }[] }): boolean {
    return this.hasImages(message);
  }
}

describe("BaseProvider", () => {
  describe("supportsModel", () => {
    it("should return true for exact model match", () => {
      const provider = new TestProvider();
      expect(provider.supportsModel("model-1")).toBe(true);
      expect(provider.supportsModel("model-2")).toBe(true);
    });

    it("should return false for non-matching model", () => {
      const provider = new TestProvider();
      expect(provider.supportsModel("unknown-model")).toBe(false);
    });

    it("should support wildcard patterns", () => {
      const provider = new TestProvider();
      expect(provider.supportsModel("model-prefix-v1")).toBe(true);
      expect(provider.supportsModel("model-prefix-v2-large")).toBe(true);
      expect(provider.supportsModel("other-prefix-v1")).toBe(false);
    });
  });

  describe("validateRequest", () => {
    const provider = new TestProvider();
    const validRequest: ChatRequest = {
      model: "model-1",
      messages: [{ role: "user", content: "Hello" }],
      maxTokens: 100,
    };

    it("should pass for valid request", () => {
      expect(() => provider.testValidateRequest(validRequest)).not.toThrow();
    });

    it("should throw for missing model", () => {
      expect(() =>
        provider.testValidateRequest({ ...validRequest, model: "" })
      ).toThrow(ValidationError);
    });

    it("should throw for empty messages", () => {
      expect(() =>
        provider.testValidateRequest({ ...validRequest, messages: [] })
      ).toThrow(ValidationError);
    });

    it("should throw for non-positive maxTokens", () => {
      expect(() =>
        provider.testValidateRequest({ ...validRequest, maxTokens: 0 })
      ).toThrow(ValidationError);
      expect(() =>
        provider.testValidateRequest({ ...validRequest, maxTokens: -1 })
      ).toThrow(ValidationError);
    });

    it("should throw for invalid temperature", () => {
      expect(() =>
        provider.testValidateRequest({ ...validRequest, temperature: -0.1 })
      ).toThrow(ValidationError);
      expect(() =>
        provider.testValidateRequest({ ...validRequest, temperature: 2.1 })
      ).toThrow(ValidationError);
    });

    it("should throw for invalid topP", () => {
      expect(() =>
        provider.testValidateRequest({ ...validRequest, topP: -0.1 })
      ).toThrow(ValidationError);
      expect(() =>
        provider.testValidateRequest({ ...validRequest, topP: 1.1 })
      ).toThrow(ValidationError);
    });

    it("should accept valid temperature and topP", () => {
      expect(() =>
        provider.testValidateRequest({ ...validRequest, temperature: 0, topP: 0 })
      ).not.toThrow();
      expect(() =>
        provider.testValidateRequest({ ...validRequest, temperature: 2, topP: 1 })
      ).not.toThrow();
    });
  });

  describe("checkAbort", () => {
    const provider = new TestProvider();

    it("should not throw when signal is undefined", () => {
      expect(() => provider.testCheckAbort(undefined)).not.toThrow();
    });

    it("should not throw when signal is not aborted", () => {
      const controller = new AbortController();
      expect(() => provider.testCheckAbort(controller.signal)).not.toThrow();
    });

    it("should throw AbortError when signal is aborted", () => {
      const controller = new AbortController();
      controller.abort("User cancelled");
      expect(() => provider.testCheckAbort(controller.signal)).toThrow(AbortError);
    });
  });

  describe("getTextContent", () => {
    const provider = new TestProvider();

    it("should return string content as-is", () => {
      expect(provider.testGetTextContent({ role: "user", content: "Hello" })).toBe("Hello");
    });

    it("should extract text from content blocks", () => {
      const message = {
        role: "user" as const,
        content: [
          { type: "text" as const, text: "Hello" },
          { type: "text" as const, text: "World" },
        ],
      };
      expect(provider.testGetTextContent(message)).toBe("Hello\nWorld");
    });
  });

  describe("hasImages", () => {
    const provider = new TestProvider();

    it("should return false for string content", () => {
      expect(provider.testHasImages({ role: "user", content: "Hello" })).toBe(false);
    });

    it("should return true when content has image blocks", () => {
      const message = {
        role: "user" as const,
        content: [
          { type: "image" as const, source: { type: "base64" as const, mediaType: "image/png" as const, data: "abc" } },
        ],
      };
      expect(provider.testHasImages(message)).toBe(true);
    });
  });

  describe("dispose", () => {
    it("should resolve without error", async () => {
      const provider = new TestProvider();
      await expect(provider.dispose()).resolves.toBeUndefined();
    });
  });
});

describe("isLLMProvider", () => {
  it("should return true for valid provider", () => {
    const provider = new TestProvider();
    expect(isLLMProvider(provider)).toBe(true);
  });

  it("should return false for null", () => {
    expect(isLLMProvider(null)).toBe(false);
  });

  it("should return false for non-object", () => {
    expect(isLLMProvider("string")).toBe(false);
    expect(isLLMProvider(123)).toBe(false);
  });

  it("should return false for object missing required properties", () => {
    expect(isLLMProvider({ name: "test" })).toBe(false);
    expect(isLLMProvider({ chatCompletion: () => {} })).toBe(false);
  });

  it("should return false when methods are not functions", () => {
    expect(isLLMProvider({ name: "test", chatCompletion: "not a function", streamCompletion: () => {} })).toBe(false);
  });
});
