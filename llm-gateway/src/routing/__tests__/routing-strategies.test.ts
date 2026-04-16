import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoundRobinStrategy } from "../strategies/round-robin-strategy.js";
import { CostBasedStrategy } from "../strategies/cost-based-strategy.js";
import { CapabilityBasedStrategy } from "../strategies/capability-based-strategy.js";
import { isRoutingStrategy } from "../routing-strategy.js";
import type { ProviderInfo } from "../routing-strategy.js";
import type { LLMProvider } from "../../providers/index.js";
import type { ChatRequest, ProviderName, ProviderCapabilities } from "../../core/index.js";

// Mock provider factory
function createMockProvider(
  name: string,
  capabilities: Partial<ProviderCapabilities> = {}
): LLMProvider {
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
      ...capabilities,
    } as ProviderCapabilities),
  } as unknown as LLMProvider;
}

function createProviderInfo(
  name: ProviderName,
  healthy = true,
  capabilities: Partial<ProviderCapabilities> = {}
): ProviderInfo {
  return {
    name,
    provider: createMockProvider(name, capabilities),
    healthy,
  };
}

function createTestRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    model: "test-model",
    messages: [{ role: "user", content: "Hello" }],
    maxTokens: 100,
    ...overrides,
  };
}

describe("isRoutingStrategy", () => {
  it("returns true for valid strategy", () => {
    const strategy = new RoundRobinStrategy();
    expect(isRoutingStrategy(strategy)).toBe(true);
  });

  it("returns false for non-objects", () => {
    expect(isRoutingStrategy(null)).toBe(false);
    expect(isRoutingStrategy(undefined)).toBe(false);
    expect(isRoutingStrategy("string")).toBe(false);
    expect(isRoutingStrategy(123)).toBe(false);
  });

  it("returns false for objects missing required properties", () => {
    expect(isRoutingStrategy({ name: "test" })).toBe(false);
    expect(isRoutingStrategy({ select: () => null })).toBe(false);
  });
});

describe("RoundRobinStrategy", () => {
  let strategy: RoundRobinStrategy;

  beforeEach(() => {
    strategy = new RoundRobinStrategy();
  });

  it("has correct name", () => {
    expect(strategy.name).toBe("round-robin");
  });

  it("returns null for empty providers", () => {
    const result = strategy.select(createTestRequest(), []);
    expect(result).toBeNull();
  });

  it("returns null when no healthy providers", () => {
    const providers = [
      createProviderInfo("anthropic" as ProviderName, false),
      createProviderInfo("openai" as ProviderName, false),
    ];
    const result = strategy.select(createTestRequest(), providers);
    expect(result).toBeNull();
  });

  it("distributes evenly across healthy providers", () => {
    const providers = [
      createProviderInfo("anthropic" as ProviderName),
      createProviderInfo("openai" as ProviderName),
      createProviderInfo("ollama" as ProviderName),
    ];
    const request = createTestRequest();

    const results: ProviderName[] = [];
    for (let i = 0; i < 6; i++) {
      results.push(strategy.select(request, providers)!);
    }

    // Should cycle through all 3 providers twice
    expect(results).toEqual([
      "anthropic",
      "openai",
      "ollama",
      "anthropic",
      "openai",
      "ollama",
    ]);
  });

  it("skips unhealthy providers in rotation", () => {
    const providers = [
      createProviderInfo("anthropic" as ProviderName),
      createProviderInfo("openai" as ProviderName, false), // unhealthy
      createProviderInfo("ollama" as ProviderName),
    ];
    const request = createTestRequest();

    const results: ProviderName[] = [];
    for (let i = 0; i < 4; i++) {
      results.push(strategy.select(request, providers)!);
    }

    // Should only cycle between anthropic and ollama
    expect(results).toEqual(["anthropic", "ollama", "anthropic", "ollama"]);
  });

  it("reset() resets the counter", () => {
    const providers = [
      createProviderInfo("anthropic" as ProviderName),
      createProviderInfo("openai" as ProviderName),
    ];
    const request = createTestRequest();

    strategy.select(request, providers); // anthropic
    strategy.select(request, providers); // openai
    strategy.reset();
    const result = strategy.select(request, providers);

    expect(result).toBe("anthropic"); // Back to first
  });
});

describe("CostBasedStrategy", () => {
  it("has correct name", () => {
    const strategy = new CostBasedStrategy({});
    expect(strategy.name).toBe("cost-based");
  });

  it("returns null for empty providers", () => {
    const strategy = new CostBasedStrategy({});
    const result = strategy.select(createTestRequest(), []);
    expect(result).toBeNull();
  });

  it("returns null when no healthy providers", () => {
    const strategy = new CostBasedStrategy({});
    const providers = [createProviderInfo("anthropic" as ProviderName, false)];
    const result = strategy.select(createTestRequest(), providers);
    expect(result).toBeNull();
  });

  it("selects cheapest provider", () => {
    const strategy = new CostBasedStrategy({
      anthropic: { inputTokenCost: 3.0, outputTokenCost: 15.0 },
      openai: { inputTokenCost: 5.0, outputTokenCost: 15.0 },
      ollama: { inputTokenCost: 0.1, outputTokenCost: 0.1 }, // cheapest
    });

    const providers = [
      createProviderInfo("anthropic" as ProviderName),
      createProviderInfo("openai" as ProviderName),
      createProviderInfo("ollama" as ProviderName),
    ];

    const result = strategy.select(createTestRequest(), providers);
    expect(result).toBe("ollama");
  });

  it("falls back to first healthy when no cost data", () => {
    const strategy = new CostBasedStrategy({}); // no costs defined

    const providers = [
      createProviderInfo("anthropic" as ProviderName),
      createProviderInfo("openai" as ProviderName),
    ];

    const result = strategy.select(createTestRequest(), providers);
    expect(result).toBe("anthropic"); // first healthy
  });

  it("setCost updates provider cost", () => {
    const strategy = new CostBasedStrategy({
      anthropic: { inputTokenCost: 10.0, outputTokenCost: 10.0 },
    });

    const providers = [
      createProviderInfo("anthropic" as ProviderName),
      createProviderInfo("openai" as ProviderName),
    ];

    // Initially no openai cost, should pick anthropic (only one with cost)
    let result = strategy.select(createTestRequest(), providers);
    expect(result).toBe("anthropic");

    // Add cheaper openai cost
    strategy.setCost("openai" as ProviderName, {
      inputTokenCost: 0.1,
      outputTokenCost: 0.1,
    });

    result = strategy.select(createTestRequest(), providers);
    expect(result).toBe("openai");
  });

  it("estimates tokens from message content", () => {
    const strategy = new CostBasedStrategy({
      anthropic: { inputTokenCost: 1.0, outputTokenCost: 1.0 },
    });

    const providers = [createProviderInfo("anthropic" as ProviderName)];

    // With longer message, cost estimate should still work
    const longRequest = createTestRequest({
      messages: [{ role: "user", content: "A".repeat(4000) }], // ~1000 tokens
    });

    const result = strategy.select(longRequest, providers);
    expect(result).toBe("anthropic");
  });

  it("handles multimodal content blocks", () => {
    const strategy = new CostBasedStrategy({
      anthropic: { inputTokenCost: 1.0, outputTokenCost: 1.0 },
    });

    const providers = [createProviderInfo("anthropic" as ProviderName)];

    const request = createTestRequest({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image" },
            {
              type: "image",
              source: { type: "base64", mediaType: "image/png", data: "abc123" },
            },
          ],
        },
      ],
    });

    const result = strategy.select(request, providers);
    expect(result).toBe("anthropic");
  });
});

describe("CapabilityBasedStrategy", () => {
  let strategy: CapabilityBasedStrategy;

  beforeEach(() => {
    strategy = new CapabilityBasedStrategy();
  });

  it("has correct name", () => {
    expect(strategy.name).toBe("capability-based");
  });

  it("returns null for empty providers", () => {
    const result = strategy.select(createTestRequest(), []);
    expect(result).toBeNull();
  });

  it("returns null when no healthy providers", () => {
    const providers = [createProviderInfo("anthropic" as ProviderName, false)];
    const result = strategy.select(createTestRequest(), providers);
    expect(result).toBeNull();
  });

  it("selects provider with tools support when needed", () => {
    const providers = [
      createProviderInfo("anthropic" as ProviderName, true, { tools: false }),
      createProviderInfo("openai" as ProviderName, true, { tools: true }),
    ];

    const request = createTestRequest({
      tools: [
        {
          type: "function",
          function: {
            name: "test",
            description: "test",
            parameters: { type: "object" },
          },
        },
      ],
    });

    const result = strategy.select(request, providers);
    expect(result).toBe("openai");
  });

  it("selects provider with vision support when needed", () => {
    const providers = [
      createProviderInfo("ollama" as ProviderName, true, { vision: false }),
      createProviderInfo("anthropic" as ProviderName, true, { vision: true }),
    ];

    const request = createTestRequest({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What is this?" },
            {
              type: "image",
              source: { type: "base64", mediaType: "image/png", data: "abc" },
            },
          ],
        },
      ],
    });

    const result = strategy.select(request, providers);
    expect(result).toBe("anthropic");
  });

  it("selects provider with JSON mode when needed", () => {
    const providers = [
      createProviderInfo("ollama" as ProviderName, true, { jsonMode: false }),
      createProviderInfo("openai" as ProviderName, true, { jsonMode: true }),
    ];

    const request = createTestRequest({
      responseFormat: { type: "json_object" },
    });

    const result = strategy.select(request, providers);
    expect(result).toBe("openai");
  });

  it("returns null when no provider matches requirements", () => {
    const providers = [
      createProviderInfo("anthropic" as ProviderName, true, { tools: false }),
      createProviderInfo("openai" as ProviderName, true, { tools: false }),
    ];

    const request = createTestRequest({
      tools: [
        {
          type: "function",
          function: {
            name: "test",
            description: "test",
            parameters: { type: "object" },
          },
        },
      ],
    });

    const result = strategy.select(request, providers);
    expect(result).toBeNull();
  });

  it("returns first capable when multiple match", () => {
    const providers = [
      createProviderInfo("anthropic" as ProviderName, true, { tools: true }),
      createProviderInfo("openai" as ProviderName, true, { tools: true }),
    ];

    const request = createTestRequest({
      tools: [
        {
          type: "function",
          function: {
            name: "test",
            description: "test",
            parameters: { type: "object" },
          },
        },
      ],
    });

    const result = strategy.select(request, providers);
    expect(result).toBe("anthropic"); // first match
  });

  it("selects any capable provider for basic request", () => {
    const providers = [
      createProviderInfo("anthropic" as ProviderName),
      createProviderInfo("openai" as ProviderName),
    ];

    const result = strategy.select(createTestRequest(), providers);
    expect(result).toBe("anthropic");
  });
});
