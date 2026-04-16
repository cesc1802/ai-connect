# LLM Gateway - Quick Start Guide

**Duration:** 5-10 minutes  
**Prerequisites:** Node.js 16+, TypeScript knowledge, API keys for desired providers

## 1. Install

```bash
npm install llm-gateway
```

## 2. Set Environment Variables

Choose one or more providers and set their API keys:

```bash
# Anthropic
export ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
export OPENAI_API_KEY=sk-...

# MiniMax
export MINIMAX_API_KEY=...

# Ollama (optional - local, no key needed)
# Default: http://localhost:11434
```

## 3. Create Your First Gateway

Create `test-gateway.ts`:

```typescript
import { LLMGateway } from "./src/gateway.js";

const gateway = new LLMGateway({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
  },
  defaultProvider: "anthropic",
});

const response = await gateway.chat({
  model: "claude-sonnet-4-20250514",
  messages: [{ role: "user", content: "Say hello!" }],
  maxTokens: 100,
});

console.log(response.content);

await gateway.dispose();
```

Run it:

```bash
npx tsx test-gateway.ts
```

Expected output:
```
Hello! How can I help you today?
```

## 4. Try Different Providers

Switch providers by changing `defaultProvider`:

```typescript
// Option 1: Anthropic
const gateway = new LLMGateway({
  providers: { anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! } },
  defaultProvider: "anthropic",
});

// Option 2: OpenAI
const gateway = new LLMGateway({
  providers: { openai: { apiKey: process.env.OPENAI_API_KEY! } },
  defaultProvider: "openai",
});

// Option 3: Multiple providers (fallback)
const gateway = new LLMGateway({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
    openai: { apiKey: process.env.OPENAI_API_KEY! },
  },
  defaultProvider: "anthropic",
});

// Option 4: Ollama (local, no API key)
const gateway = new LLMGateway({
  providers: {
    ollama: { baseUrl: "http://localhost:11434" },
  },
  defaultProvider: "ollama",
});
```

## 5. Use Streaming

```typescript
const gateway = new LLMGateway({
  providers: { openai: { apiKey: process.env.OPENAI_API_KEY! } },
  defaultProvider: "openai",
});

console.log("Streaming response:");
for await (const chunk of gateway.stream({
  model: "gpt-4-turbo",
  messages: [{ role: "user", content: "Tell a short story..." }],
  maxTokens: 500,
})) {
  if (chunk.delta.type === "text") {
    process.stdout.write(chunk.delta.text);
  }
}
console.log("\n");

await gateway.dispose();
```

## 6. Add Fallback Resilience

Automatically retry failed requests:

```typescript
const gateway = new LLMGateway({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
    openai: { apiKey: process.env.OPENAI_API_KEY! },
  },
  defaultProvider: "anthropic",
  retry: {
    maxRetries: 3,
    baseDelayMs: 1000,
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
  },
});

try {
  const response = await gateway.chat({
    model: "claude-sonnet-4-20250514",
    messages: [{ role: "user", content: "Hello" }],
    maxTokens: 100,
  });
  console.log(response.content);
} catch (error) {
  console.error("Failed after retries:", error.message);
}

await gateway.dispose();
```

## 7. Use Fallback Chains

Try multiple providers in sequence:

```typescript
const gateway = new LLMGateway({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY! },
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
    ollama: { baseUrl: "http://localhost:11434" },
  },
});

// Create chain: try OpenAI first, then Anthropic, then Ollama
const chain = gateway.createFallbackChain(["openai", "anthropic", "ollama"]);

const response = await chain.chatCompletion({
  model: "any-model",
  messages: [{ role: "user", content: "Hello" }],
  maxTokens: 100,
});

console.log("Response from:", response.model);
console.log(response.content);

await gateway.dispose();
```

## 8. Monitor Provider Health

```typescript
const gateway = new LLMGateway({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
    openai: { apiKey: process.env.OPENAI_API_KEY! },
  },
});

// Make some requests...
await gateway.chat({
  model: "claude-sonnet-4-20250514",
  messages: [{ role: "user", content: "Test" }],
  maxTokens: 100,
});

// Check health
console.log("Provider health:");
for (const providerName of gateway.getProviderNames()) {
  const healthy = gateway.isProviderHealthy(providerName);
  console.log(`  ${providerName}: ${healthy ? "✓" : "✗"}`);
}

// Get metrics
const metrics = gateway.getMetrics();
console.log("\nMetrics:");
console.log(`  Total requests: ${metrics.totalRequests}`);
console.log(`  Average latency: ${metrics.averageLatencyMs}ms`);
console.log(`  Errors: ${metrics.totalErrors}`);

for (const provider of metrics.providers) {
  console.log(`\n  ${provider.name}:`);
  console.log(`    Healthy: ${provider.healthy}`);
  console.log(`    State: ${provider.circuit.state}`);
  console.log(`    Failures: ${provider.circuit.failures}`);
}

await gateway.dispose();
```

## 9. Tool Calling / Function Calling

```typescript
const gateway = new LLMGateway({
  providers: { openai: { apiKey: process.env.OPENAI_API_KEY! } },
  defaultProvider: "openai",
});

const response = await gateway.chat({
  model: "gpt-4-turbo",
  messages: [
    {
      role: "user",
      content: "What's the weather in San Francisco?",
    },
  ],
  maxTokens: 200,
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get weather for a location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "City name",
            },
          },
          required: ["location"],
        },
      },
    },
  ],
});

if (response.toolCalls.length > 0) {
  console.log("Tool calls requested:");
  for (const call of response.toolCalls) {
    console.log(`  ${call.function.name}(${call.function.arguments})`);
  }
} else {
  console.log("Response:", response.content);
}

await gateway.dispose();
```

## 10. Vision / Multimodal Support

```typescript
const gateway = new LLMGateway({
  providers: { anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! } },
  defaultProvider: "anthropic",
});

const response = await gateway.chat({
  model: "claude-sonnet-4-20250514",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What's in this image?" },
        {
          type: "image",
          source: {
            type: "url",
            mediaType: "image/jpeg",
            data: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png",
          },
        },
      ],
    },
  ],
  maxTokens: 200,
});

console.log(response.content);

await gateway.dispose();
```

## Common Patterns

### Pattern 1: Cost-Optimized Routing

Try cheap providers first:

```typescript
const gateway = new LLMGateway({
  providers: {
    minimax: { apiKey: process.env.MINIMAX_API_KEY! },    // Cheapest
    openai: { apiKey: process.env.OPENAI_API_KEY! },      // Expensive
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! }, // Mid-price
  },
  routing: {
    strategy: "cost-based",
    costPerMillionTokens: {
      minimax: 500,      // $0.50/1M
      openai: 5000,      // $5/1M
      anthropic: 3000,   // $3/1M
    },
  },
});
```

### Pattern 2: Capability-Based Routing

Use appropriate provider for the task:

```typescript
const gateway = new LLMGateway({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY! },      // Supports vision + tools
    minimax: { apiKey: process.env.MINIMAX_API_KEY! },    // Text-only, cheap
  },
  routing: { strategy: "capability-based" },
});

// Request with vision → automatically routes to OpenAI
// Request text-only → automatically routes to MiniMax
```

### Pattern 3: Explicit Provider Selection

```typescript
const gateway = new LLMGateway({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
    openai: { apiKey: process.env.OPENAI_API_KEY! },
  },
});

// Use specific provider
const response = await gateway.chat(
  {
    model: "claude-sonnet-4-20250514",
    messages: [{ role: "user", content: "Hello" }],
    maxTokens: 100,
  },
  { provider: "anthropic" }
);

// Or use provider prefix in model name
const response2 = await gateway.chat({
  model: "anthropic::claude-sonnet-4-20250514",
  messages: [{ role: "user", content: "Hello" }],
  maxTokens: 100,
});
```

## Troubleshooting

### "API key not found"
```
Error: API key is required for provider X

Solution: Set environment variable:
  export ANTHROPIC_API_KEY=sk-...
  export OPENAI_API_KEY=sk-...
```

### "Model not supported by provider"
```
Error: Model gpt-4 not supported by provider ollama

Solution: Check provider capabilities:
  const caps = provider.capabilities();
  // or check docs/project-overview-pdr.md for provider matrix
```

### "Circuit breaker is OPEN"
```
Error: CircuitOpenError: Provider anthropic is temporarily unavailable

Solution: Wait 30s for recovery timeout, or add fallback provider:
  const chain = gateway.createFallbackChain(["anthropic", "openai"]);
```

### "Request timed out"
```
Error: TimeoutError: Request timed out after 30000ms

Solution: Increase timeout or check provider status:
  { timeout: 60000 } // 60 second timeout
  gateway.isProviderHealthy("anthropic")
```

## Next Steps

1. **Read the docs:** [./docs/project-overview-pdr.md](../docs/project-overview-pdr.md)
2. **Explore examples:** [./examples/](./examples/)
3. **Check API reference:** [./docs/codebase-summary.md](../docs/codebase-summary.md)
4. **Learn architecture:** [./docs/system-architecture.md](../docs/system-architecture.md)

## Getting Help

- **GitHub Issues:** Report bugs or request features
- **GitHub Discussions:** Ask questions, share patterns
- **Documentation:** [./docs/](../docs/)
- **Examples:** [./examples/](./examples/)

Happy coding! 🚀
