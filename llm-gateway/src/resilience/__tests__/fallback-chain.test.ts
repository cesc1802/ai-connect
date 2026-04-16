import { describe, it, expect, vi, beforeEach } from "vitest";
import { FallbackChain } from "../fallback-chain.js";
import type { LLMProvider } from "../../providers/index.js";
import type { ChatRequest, ChatResponse, StreamChunk, ProviderCapabilities, ProviderName } from "../../core/index.js";
import { FallbackExhaustedError } from "../../core/index.js";

function createMockProvider(name: ProviderName, models: string[] = ["model-1"]): LLMProvider {
  return {
    name,
    models,
    capabilities: vi.fn().mockReturnValue({
      streaming: true,
      tools: true,
      vision: true,
      jsonMode: true,
      maxContextTokens: 100000,
    } as ProviderCapabilities),
    supportsModel: vi.fn().mockImplementation((m) => models.includes(m)),
    chatCompletion: vi.fn(),
    streamCompletion: vi.fn(),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

function createTestRequest(): ChatRequest {
  return {
    model: "model-1",
    messages: [{ role: "user", content: "Hello" }],
    maxTokens: 100,
  };
}

function createTestResponse(content: string): ChatResponse {
  return {
    id: "test-id",
    content,
    toolCalls: [],
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    model: "model-1",
    finishReason: "stop",
    latencyMs: 100,
  };
}

async function* createMockStream(text: string): AsyncIterable<StreamChunk> {
  yield { id: "1", delta: { type: "text", text } };
  yield { id: "1", delta: { type: "text", text: "!" }, finishReason: "stop" };
}

describe("FallbackChain", () => {
  let provider1: LLMProvider;
  let provider2: LLMProvider;
  let provider3: LLMProvider;

  beforeEach(() => {
    provider1 = createMockProvider("anthropic", ["model-1", "model-2"]);
    provider2 = createMockProvider("openai", ["model-1", "model-3"]);
    provider3 = createMockProvider("ollama", ["model-4"]);
  });

  describe("constructor", () => {
    it("requires at least one provider", () => {
      expect(() => new FallbackChain([])).toThrow("FallbackChain requires at least one provider");
    });

    it("uses first provider name", () => {
      const chain = new FallbackChain([provider1, provider2]);
      expect(chain.name).toBe("anthropic");
    });

    it("combines models from all providers", () => {
      const chain = new FallbackChain([provider1, provider2, provider3]);
      expect(chain.models).toContain("model-1");
      expect(chain.models).toContain("model-2");
      expect(chain.models).toContain("model-3");
      expect(chain.models).toContain("model-4");
    });

    it("deduplicates models", () => {
      const chain = new FallbackChain([provider1, provider2]);
      const modelCount = chain.models.filter((m) => m === "model-1").length;
      expect(modelCount).toBe(1);
    });
  });

  describe("capabilities", () => {
    it("returns intersection of streaming capability", () => {
      (provider2.capabilities as ReturnType<typeof vi.fn>).mockReturnValue({
        streaming: false,
        tools: true,
        vision: true,
        jsonMode: true,
        maxContextTokens: 50000,
      });

      const chain = new FallbackChain([provider1, provider2]);
      expect(chain.capabilities().streaming).toBe(false);
    });

    it("returns union of tool capability", () => {
      (provider2.capabilities as ReturnType<typeof vi.fn>).mockReturnValue({
        streaming: true,
        tools: false,
        vision: false,
        jsonMode: false,
        maxContextTokens: 50000,
      });

      const chain = new FallbackChain([provider1, provider2]);
      expect(chain.capabilities().tools).toBe(true);
    });

    it("returns max context tokens", () => {
      (provider2.capabilities as ReturnType<typeof vi.fn>).mockReturnValue({
        streaming: true,
        tools: true,
        vision: true,
        jsonMode: true,
        maxContextTokens: 200000,
      });

      const chain = new FallbackChain([provider1, provider2]);
      expect(chain.capabilities().maxContextTokens).toBe(200000);
    });
  });

  describe("supportsModel", () => {
    it("returns true if any provider supports model", () => {
      const chain = new FallbackChain([provider1, provider2, provider3]);
      expect(chain.supportsModel("model-4")).toBe(true);
    });

    it("returns false if no provider supports model", () => {
      const chain = new FallbackChain([provider1, provider2]);
      expect(chain.supportsModel("model-99")).toBe(false);
    });
  });

  describe("getProviders", () => {
    it("returns copy of providers array", () => {
      const chain = new FallbackChain([provider1, provider2]);
      const providers = chain.getProviders();
      expect(providers).toHaveLength(2);
      expect(providers[0]).toBe(provider1);
      expect(providers[1]).toBe(provider2);
    });
  });

  describe("dispose", () => {
    it("disposes all providers", async () => {
      const chain = new FallbackChain([provider1, provider2, provider3]);
      await chain.dispose();

      expect(provider1.dispose).toHaveBeenCalled();
      expect(provider2.dispose).toHaveBeenCalled();
      expect(provider3.dispose).toHaveBeenCalled();
    });
  });

  describe("chatCompletion", () => {
    it("returns first successful result", async () => {
      (provider1.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(
        createTestResponse("Hello from provider1")
      );

      const chain = new FallbackChain([provider1, provider2]);
      const response = await chain.chatCompletion(createTestRequest());

      expect(response.content).toBe("Hello from provider1");
      expect(provider1.chatCompletion).toHaveBeenCalled();
      expect(provider2.chatCompletion).not.toHaveBeenCalled();
    });

    it("tries next provider on failure", async () => {
      (provider1.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Provider 1 failed"));
      (provider2.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue(
        createTestResponse("Hello from provider2")
      );

      const chain = new FallbackChain([provider1, provider2]);
      const response = await chain.chatCompletion(createTestRequest());

      expect(response.content).toBe("Hello from provider2");
      expect(provider1.chatCompletion).toHaveBeenCalled();
      expect(provider2.chatCompletion).toHaveBeenCalled();
    });

    it("collects all errors when exhausted", async () => {
      (provider1.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Error 1"));
      (provider2.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Error 2"));
      (provider3.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Error 3"));

      const chain = new FallbackChain([provider1, provider2, provider3]);

      try {
        await chain.chatCompletion(createTestRequest());
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(FallbackExhaustedError);
        const fbError = error as FallbackExhaustedError;
        expect(fbError.errors).toHaveLength(3);
        expect(fbError.errors[0]!.message).toBe("Error 1");
        expect(fbError.errors[1]!.message).toBe("Error 2");
        expect(fbError.errors[2]!.message).toBe("Error 3");
      }
    });

    it("converts non-Error to Error", async () => {
      (provider1.chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValue("string error");

      const chain = new FallbackChain([provider1]);

      try {
        await chain.chatCompletion(createTestRequest());
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(FallbackExhaustedError);
        const fbError = error as FallbackExhaustedError;
        expect(fbError.errors[0]!.message).toBe("string error");
      }
    });
  });

  describe("streamCompletion", () => {
    it("returns first successful stream", async () => {
      (provider1.streamCompletion as ReturnType<typeof vi.fn>).mockReturnValue(createMockStream("Hello"));

      const chain = new FallbackChain([provider1, provider2]);
      const chunks: StreamChunk[] = [];

      for await (const chunk of chain.streamCompletion(createTestRequest())) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(provider1.streamCompletion).toHaveBeenCalled();
      expect(provider2.streamCompletion).not.toHaveBeenCalled();
    });

    it("falls back on stream error", async () => {
      async function* failingStream(): AsyncIterable<StreamChunk> {
        throw new Error("Stream failed");
      }
      (provider1.streamCompletion as ReturnType<typeof vi.fn>).mockReturnValue(failingStream());
      (provider2.streamCompletion as ReturnType<typeof vi.fn>).mockReturnValue(createMockStream("Fallback"));

      const chain = new FallbackChain([provider1, provider2]);
      const chunks: StreamChunk[] = [];

      for await (const chunk of chain.streamCompletion(createTestRequest())) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(provider1.streamCompletion).toHaveBeenCalled();
      expect(provider2.streamCompletion).toHaveBeenCalled();
    });

    it("collects errors when all streams fail", async () => {
      async function* failingStream1(): AsyncIterable<StreamChunk> {
        throw new Error("Stream 1 failed");
      }
      async function* failingStream2(): AsyncIterable<StreamChunk> {
        throw new Error("Stream 2 failed");
      }
      (provider1.streamCompletion as ReturnType<typeof vi.fn>).mockReturnValue(failingStream1());
      (provider2.streamCompletion as ReturnType<typeof vi.fn>).mockReturnValue(failingStream2());

      const chain = new FallbackChain([provider1, provider2]);

      try {
        for await (const _chunk of chain.streamCompletion(createTestRequest())) {
          // Consume
        }
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(FallbackExhaustedError);
        const fbError = error as FallbackExhaustedError;
        expect(fbError.errors).toHaveLength(2);
      }
    });
  });
});
