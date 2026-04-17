# LLM Gateway

A unified TypeScript SDK for multiple LLM providers with resilience patterns, intelligent routing, and observability.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen)](./llm-gateway/src/__tests__)

## Why LLM Gateway?

Building LLM applications requires integrating with multiple providers (Anthropic, OpenAI, Ollama, etc.), each with different APIs and error handling patterns. Without a unified abstraction, applications become:

- **Fragile:** Provider failures cascade to end users
- **Expensive:** No intelligent cost optimization across providers
- **Complex:** Duplicate error handling and retry logic everywhere
- **Blind:** Missing visibility into LLM performance and costs

LLM Gateway solves these problems with:

| Problem | Solution |
|---------|----------|
| Multiple APIs | Unified `chat()` and `stream()` interface |
| Provider failures | Circuit breaker + fallback chains |
| Cost inefficiency | Cost-based and capability-based routing |
| Missing visibility | OpenTelemetry integration for tracing & metrics |

## Quick Start

### Installation

```bash
npm install llm-gateway
```

### Basic Usage

```typescript
import { LLMGateway } from "llm-gateway";

// Create gateway with one or more providers
const gateway = new LLMGateway({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
    openai: { apiKey: process.env.OPENAI_API_KEY! },
  },
  defaultProvider: "anthropic",
});

// Make a request (unified API works with any provider)
const response = await gateway.chat({
  model: "claude-sonnet-4-20250514",
  messages: [{ role: "user", content: "What is 2+2?" }],
  maxTokens: 1024,
});

console.log(response.content); // "4"
console.log(response.latencyMs); // 234

// Cleanup
await gateway.dispose();
```

### Streaming

```typescript
// Stream responses chunk-by-chunk
for await (const chunk of gateway.stream({
  model: "gpt-4-turbo",
  messages: [{ role: "user", content: "Tell me a story..." }],
  maxTokens: 2048,
})) {
  if (chunk.delta.type === "text") {
    process.stdout.write(chunk.delta.text);
  }
}
```

### Fallback Chains

```typescript
// Automatically fallback to cheaper providers on failure
const fallbackChain = gateway.createFallbackChain([
  "openai",      // Try expensive, high-quality provider first
  "ollama",      // Fallback to local model
  "minimax",     // Last resort: cheap but limited
]);

const response = await fallbackChain.chatCompletion({
  model: "any-model",
  messages: [/* ... */],
  maxTokens: 1024,
});
// If OpenAI fails, automatically tries Ollama, then MiniMax
```

### Provider Selection

```typescript
// Explicit provider selection
const response = await gateway.chat(
  {
    model: "claude-sonnet-4-20250514",
    messages: [{ role: "user", content: "Hello" }],
    maxTokens: 1024,
  },
  { provider: "anthropic" } // Use specific provider
);

// Model-based selection (prefix: provider::model-name)
const response = await gateway.chat({
  model: "anthropic::claude-sonnet-4-20250514",
  messages: [{ role: "user", content: "Hello" }],
  maxTokens: 1024,
});
```

## Supported Providers

| Provider | Status | Streaming | Tools | Vision | JSON Mode | Max Context |
|----------|--------|-----------|-------|--------|-----------|-------------|
| **Anthropic Claude** | ✅ Supported | Yes | Yes | Yes | No | 200K |
| **OpenAI GPT** | ✅ Supported | Yes | Yes | Yes | Yes | 128K |
| **Ollama** | ✅ Supported | Yes | Yes | Yes | Yes | 128K |
| **MiniMax** | ✅ Supported | Yes | No | No | No | 245K |

### Provider Configuration

#### Anthropic
```typescript
{
  providers: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: "https://api.anthropic.com", // optional
    }
  }
}
```

#### OpenAI
```typescript
{
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: "https://api.openai.com/v1", // optional
    }
  }
}
```

#### Ollama (Local)
```typescript
{
  providers: {
    ollama: {
      baseUrl: "http://localhost:11434", // optional, default shown
    }
  }
}
```

#### MiniMax
```typescript
{
  providers: {
    minimax: {
      apiKey: process.env.MINIMAX_API_KEY,
      baseUrl: "https://api.minimax.chat/v1", // optional
    }
  }
}
```

## Resilience Features

### Circuit Breaker

Automatically stop sending requests to failing providers:

```typescript
const gateway = new LLMGateway({
  providers: { anthropic: {...}, openai: {...} },
  circuitBreaker: {
    failureThreshold: 5,      // Open after 5 failures
    resetTimeoutMs: 30000,    // Try recovery after 30s
    probeRequests: 3,         // Need 3 successes to close
  },
});

// If Anthropic fails 5 times, circuit opens
// Gateway automatically routes to OpenAI
// After 30s, tries Anthropic again with 3 test requests
```

### Automatic Retries

Transparent retry with exponential backoff for transient errors:

```typescript
const gateway = new LLMGateway({
  providers: { anthropic: {...} },
  retry: {
    maxRetries: 3,           // Max 3 attempts
    baseDelayMs: 1000,       // Start 1s, double each time
    maxDelayMs: 10000,       // Cap at 10s
  },
});

// Timeouts and rate limits automatically retry
// Non-retryable errors (auth, validation) fail immediately
```

### Fallback Chains

Guaranteed availability through sequential provider attempts:

```typescript
const fallback = gateway.createFallbackChain([
  "openai",      // Primary: high-quality
  "anthropic",   // Secondary: proven stable
  "ollama",      // Tertiary: local fallback
]);

// Tries each in order until one succeeds
// Aggregates capabilities (union of features)
// Throws FallbackExhaustedError if all fail
```

## Intelligent Routing

### Round-Robin

Even load distribution:

```typescript
const gateway = new LLMGateway({
  providers: { openai: {...}, anthropic: {...} },
  routing: {
    strategy: "round-robin",
    defaultProvider: "openai",
  },
});

// Request 1 → OpenAI
// Request 2 → Anthropic
// Request 3 → OpenAI
// (cycles through all healthy providers)
```

### Cost-Based Routing

Minimize expenses:

```typescript
const gateway = new LLMGateway({
  providers: { openai: {...}, ollama: {...}, minimax: {...} },
  routing: {
    strategy: "cost-based",
    costPerMillionTokens: {
      openai: 5000,    // $5 per 1M tokens
      ollama: 0,       // Free (local)
      minimax: 500,    // $0.50 per 1M tokens
    },
  },
});

// Always tries cheapest available provider first
// Falls back to expensive if cheap unavailable
```

### Capability-Based Routing

Match providers to request needs:

```typescript
const gateway = new LLMGateway({
  providers: { openai: {...}, minimax: {...} },
  routing: { strategy: "capability-based" },
});

// Request with tools → Routes to OpenAI (minimax doesn't support)
// Request with vision → Routes to OpenAI or Anthropic
// Request text-only → Routes to MiniMax (cheapest)
```

## Observability

### OpenTelemetry Integration

Export metrics to Prometheus, traces to Jaeger:

```typescript
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";

const exporter = new PrometheusExporter({ port: 9090 });
const meterProvider = new MeterProvider({
  readers: [new PeriodicExportingMetricReader({ exporter })],
});

const gateway = new LLMGateway({
  providers: { anthropic: {...} },
  telemetry: { meterProvider },
});

// Metrics exported: llm.requests, llm.errors, llm.latency, llm.tokens
// View at http://localhost:9090/metrics
```

### Health Status

```typescript
// Check individual provider health
if (gateway.isProviderHealthy("anthropic")) {
  console.log("✓ Anthropic is healthy");
} else {
  console.log("✗ Anthropic circuit is open, using fallback");
}

// Get aggregated metrics
const metrics = gateway.getMetrics();
console.log("Total requests:", metrics.totalRequests);
console.log("Average latency:", metrics.averageLatencyMs, "ms");
console.log("Provider details:", metrics.providers);
// Output:
// [
//   { name: "anthropic", healthy: true, circuit: { state: "closed", failures: 0 } },
//   { name: "openai", healthy: false, circuit: { state: "open", failures: 5 } }
// ]
```

## Advanced Patterns

### Multimodal Requests (Vision)

```typescript
const response = await gateway.chat({
  model: "claude-sonnet-4-20250514", // Supports vision
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
            data: "https://example.com/image.jpg",
          },
        },
      ],
    },
  ],
  maxTokens: 1024,
});
```

### Tool Calling / Function Calling

```typescript
const response = await gateway.chat({
  model: "gpt-4-turbo",
  messages: [
    {
      role: "user",
      content: "Get the weather for San Francisco",
    },
  ],
  maxTokens: 1024,
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get weather for a location",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string" },
          },
          required: ["location"],
        },
      },
    },
  ],
});

// response.toolCalls = [
//   { id: "call_xxx", function: { name: "get_weather", arguments: '{"location":"San Francisco"}' } }
// ]
```

### Request Cancellation

```typescript
const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  const response = await gateway.chat(
    {
      model: "gpt-4-turbo",
      messages: [{ role: "user", content: "Long request..." }],
      maxTokens: 4096,
    },
    { signal: controller.signal }
  );
} catch (error) {
  if (error.name === "AbortError") {
    console.log("Request cancelled");
  }
}
```

## Error Handling

```typescript
import {
  LLMError,
  AuthenticationError,
  RateLimitError,
  TimeoutError,
  CircuitOpenError,
  FallbackExhaustedError,
} from "llm-gateway";

try {
  const response = await gateway.chat({
    model: "claude-sonnet-4",
    messages: [{ role: "user", content: "Hello" }],
    maxTokens: 1024,
  });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error("Check your API key");
  } else if (error instanceof RateLimitError) {
    console.error("Rate limited, retrying later...");
  } else if (error instanceof TimeoutError) {
    console.error("Request timed out");
  } else if (error instanceof CircuitOpenError) {
    console.error("Provider is temporarily unavailable");
  } else if (error instanceof FallbackExhaustedError) {
    console.error("All providers failed");
  } else if (error instanceof LLMError) {
    console.error(`LLM Error: ${error.message} (code: ${error.code})`);
  } else {
    console.error("Unknown error", error);
  }
}
```

## Type-Safe Request/Response

Full TypeScript support with auto-completion:

```typescript
import type { ChatRequest, ChatResponse } from "llm-gateway";

// Request is fully typed
const request: ChatRequest = {
  model: "claude-sonnet-4-20250514",
  messages: [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" },
  ],
  maxTokens: 1024,
  temperature: 0.7, // 0-2
  topP: 0.9,        // 0-1
  tools: [
    {
      type: "function",
      function: {
        name: "example",
        description: "Example tool",
        parameters: { type: "object", properties: {} },
      },
    },
  ],
};

// Response is fully typed
const response: ChatResponse = await gateway.chat(request);

console.log(response.content);      // string
console.log(response.toolCalls);    // ToolCall[]
console.log(response.usage);        // TokenUsage
console.log(response.finishReason); // "stop" | "length" | "tool_calls"
console.log(response.latencyMs);    // number
```

## Configuration Reference

```typescript
interface GatewayConfig {
  // Required: at least one provider
  providers: {
    anthropic?: { apiKey: string; baseUrl?: string };
    openai?: { apiKey: string; baseUrl?: string };
    ollama?: { baseUrl?: string };
    minimax?: { apiKey: string; baseUrl?: string };
  };

  // Optional: provider to use if not explicitly specified
  defaultProvider?: "anthropic" | "openai" | "ollama" | "minimax";

  // Optional: retry policy
  retry?: {
    maxRetries?: number;      // default: 3
    baseDelayMs?: number;     // default: 1000
    maxDelayMs?: number;      // default: 10000
  };

  // Optional: circuit breaker
  circuitBreaker?: {
    failureThreshold?: number;    // default: 5
    resetTimeoutMs?: number;      // default: 30000
    probeRequests?: number;       // default: 3
  };

  // Optional: global request timeout
  timeoutMs?: number;           // default: 30000

  // Optional: telemetry export
  telemetry?: {
    meterProvider?: MeterProvider;
  };
}
```

## Examples

Runnable examples are in [`llm-gateway/examples/`](./llm-gateway/examples/):

- `gateway-basic.ts` - Basic chat and metrics
- `gateway-streaming.ts` - Stream responses
- `gateway-tools.ts` - Tool calling / function calling
- `gateway-fallback.ts` - Fallback chain redundancy
- `gateway-routing.ts` - Routing strategies
- `anthropic-example.ts` - Anthropic-specific features
- `openai-example.ts` - OpenAI-specific features
- `ollama-example.ts` - Local Ollama setup
- `minimax-example.ts` - MiniMax provider

Run any example:

```bash
cd llm-gateway
ANTHROPIC_API_KEY=sk-... npx tsx examples/gateway-basic.ts
```

## Monorepo Packages

This project is a pnpm monorepo with the following packages:

| Package | Description | Status |
|---------|-------------|--------|
| **[llm-gateway](./llm-gateway)** | Core LLM provider abstraction with resilience patterns | ✅ Stable |
| **[@ai-connect/shared](./llm-shared)** | Shared types (WebSocket protocol, auth) | ✅ Stable |
| **[@ai-connect/http](./llm-http)** | HTTP/WebSocket server with JWT auth | ✅ Stable |
| **llm-db** | Database persistence layer | 🔜 Planned |

### Package Dependencies

```
@ai-connect/http
├── llm-gateway (LLM operations)
└── @ai-connect/shared (types)

@ai-connect/shared
└── llm-gateway (re-exports ChatMessage, TokenUsage)
```

## Documentation

For more detailed information, see the docs:

- **[Project Overview & PDR](./docs/project-overview-pdr.md)** - Features, requirements, timeline
- **[Codebase Summary](./docs/codebase-summary.md)** - Module structure, key components
- **[Code Standards](./docs/code-standards.md)** - TypeScript conventions, patterns
- **[System Architecture](./docs/system-architecture.md)** - Design, data flows, extensibility
- **[Project Roadmap](./docs/project-roadmap.md)** - v1.1+, future plans, success metrics

## Testing

Run the test suite:

```bash
cd llm-gateway
npm test                    # All tests
npm test -- circuit-breaker # Single test file
npm test -- --coverage      # With coverage
```

Expected output:
```
✓ 123 tests pass
✓ 85%+ coverage
✓ <5s total runtime
```

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Provider selection | <1ms | Routing strategy logic |
| Circuit breaker check | <1μs | State lookup |
| Chat request (gateway overhead) | ~50ms | Excluding provider API latency |
| Streaming chunk yield | <100μs | Per delta |
| Metric recording | <1μs | Per request |

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Code standards and style guide
- Pull request process
- Testing requirements
- Commit message format

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Support

- **GitHub Issues:** [Bug reports & feature requests](../../issues)
- **GitHub Discussions:** [Questions & community help](../../discussions)
- **Documentation:** [./docs](./docs)

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

## Roadmap

Current: **v1.0.0** (Core release)

Upcoming:
- **v1.1.0** - Enhanced observability (Q2 2026)
- **v1.2.0** - Caching & optimization (Q2/Q3 2026)
- **v1.3.0** - Advanced routing (Q3 2026)
- **v1.4.0** - Provider ecosystem (Q3/Q4 2026)
- **v2.0.0** - Enterprise features (2027)

See [docs/project-roadmap.md](./docs/project-roadmap.md) for details.

---

**Happy LLM-ing! 🚀**
