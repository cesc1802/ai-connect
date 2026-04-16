import { describe, it, expect, vi, beforeEach } from "vitest";
import { Router } from "../router.js";
import type { IRoutingStrategy, ProviderInfo } from "../routing-strategy.js";
import type { LLMProvider } from "../../providers/index.js";
import type { ChatRequest, ProviderName, ProviderCapabilities } from "../../core/index.js";
import { ValidationError } from "../../core/index.js";

// Mock provider factory
function createMockProvider(name: string): LLMProvider {
  return {
    name,
    chat: vi.fn(),
    chatStream: vi.fn(),
    capabilities: vi.fn().mockReturnValue({
      streaming: true,
      tools: true,
      vision: true,
      jsonMode: true,
      maxContextTokens: 100000,
    } as ProviderCapabilities),
  } as unknown as LLMProvider;
}

// Mock strategy
function createMockStrategy(selectFn?: (request: ChatRequest, providers: ProviderInfo[]) => ProviderName | null): IRoutingStrategy {
  return {
    name: "mock-strategy",
    select: selectFn ?? vi.fn().mockImplementation((_req, providers) => providers[0]?.name ?? null),
  };
}

function createTestRequest(model = "test-model"): ChatRequest {
  return {
    model,
    messages: [{ role: "user", content: "Hello" }],
    maxTokens: 100,
  };
}

describe("Router", () => {
  let router: Router;
  let mockStrategy: IRoutingStrategy;
  let anthropicProvider: LLMProvider;
  let openaiProvider: LLMProvider;

  beforeEach(() => {
    mockStrategy = createMockStrategy();
    anthropicProvider = createMockProvider("anthropic");
    openaiProvider = createMockProvider("openai");

    router = new Router({ strategy: mockStrategy });
    router.register("anthropic" as ProviderName, anthropicProvider);
    router.register("openai" as ProviderName, openaiProvider);
  });

  describe("register/unregister", () => {
    it("registers providers correctly", () => {
      expect(router.getProviderNames()).toContain("anthropic");
      expect(router.getProviderNames()).toContain("openai");
      expect(router.getProvider("anthropic" as ProviderName)).toBe(anthropicProvider);
    });

    it("unregisters providers correctly", () => {
      router.unregister("openai" as ProviderName);
      expect(router.getProviderNames()).not.toContain("openai");
      expect(router.getProvider("openai" as ProviderName)).toBeUndefined();
    });

    it("registerAll adds multiple providers", () => {
      const newRouter = new Router({ strategy: mockStrategy });
      const providers = new Map<ProviderName, LLMProvider>([
        ["anthropic" as ProviderName, anthropicProvider],
        ["openai" as ProviderName, openaiProvider],
      ]);
      newRouter.registerAll(providers);
      expect(newRouter.getProviderNames()).toHaveLength(2);
    });
  });

  describe("health management", () => {
    it("providers start healthy", () => {
      expect(router.isHealthy("anthropic" as ProviderName)).toBe(true);
      expect(router.isHealthy("openai" as ProviderName)).toBe(true);
    });

    it("markUnhealthy sets provider unhealthy", () => {
      router.markUnhealthy("anthropic" as ProviderName);
      expect(router.isHealthy("anthropic" as ProviderName)).toBe(false);
    });

    it("markHealthy restores provider health", () => {
      router.markUnhealthy("anthropic" as ProviderName);
      router.markHealthy("anthropic" as ProviderName);
      expect(router.isHealthy("anthropic" as ProviderName)).toBe(true);
    });

    it("unknown provider is not healthy", () => {
      expect(router.isHealthy("unknown" as ProviderName)).toBe(false);
    });
  });

  describe("selectProvider", () => {
    it("uses strategy to select provider", () => {
      const request = createTestRequest();
      const result = router.selectProvider(request);
      expect(mockStrategy.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("extracts provider from model string", () => {
      const request = createTestRequest("anthropic/claude-3-opus");
      const result = router.selectProvider(request);
      expect(result).toBe(anthropicProvider);
    });

    it("skips unhealthy explicit provider", () => {
      router.markUnhealthy("anthropic" as ProviderName);
      const request = createTestRequest("anthropic/claude-3-opus");
      router.selectProvider(request);
      // Should fall back to strategy since explicit provider is unhealthy
      expect(mockStrategy.select).toHaveBeenCalled();
    });

    it("uses default provider when strategy returns null", () => {
      const nullStrategy = createMockStrategy(() => null);
      const routerWithDefault = new Router({
        strategy: nullStrategy,
        defaultProvider: "openai" as ProviderName,
      });
      routerWithDefault.register("anthropic" as ProviderName, anthropicProvider);
      routerWithDefault.register("openai" as ProviderName, openaiProvider);

      const result = routerWithDefault.selectProvider(createTestRequest());
      expect(result).toBe(openaiProvider);
    });

    it("uses first healthy when strategy and default fail", () => {
      const nullStrategy = createMockStrategy(() => null);
      const routerNoDefault = new Router({ strategy: nullStrategy });
      routerNoDefault.register("anthropic" as ProviderName, anthropicProvider);
      routerNoDefault.register("openai" as ProviderName, openaiProvider);

      const result = routerNoDefault.selectProvider(createTestRequest());
      expect(result).toBeDefined();
    });

    it("throws when no healthy providers", () => {
      router.markUnhealthy("anthropic" as ProviderName);
      router.markUnhealthy("openai" as ProviderName);

      expect(() => router.selectProvider(createTestRequest())).toThrow(ValidationError);
    });

    it("excludes unhealthy providers from strategy selection", () => {
      router.markUnhealthy("anthropic" as ProviderName);
      const request = createTestRequest();
      router.selectProvider(request);

      const selectCall = (mockStrategy.select as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(selectCall).toBeDefined();
      const providersArg = selectCall![1] as ProviderInfo[];
      expect(providersArg.every((p) => p.name !== "anthropic")).toBe(true);
    });
  });
});
