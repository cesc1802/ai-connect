# LLM Gateway - System Architecture

**Last Updated:** April 16, 2026  
**Version:** 1.0.0

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  (User code calling gateway.chat() or gateway.stream())      │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
    ┌────▼─────────────┐         ┌──────▼─────────────┐
    │  LLMGateway      │         │  GatewayMetrics   │
    │  (Main Facade)   │         │  (Aggregation)    │
    └────┬─────────────┘         └──────┬─────────────┘
         │                              │
    ┌────┴──────────────────────────────┴─────┐
    │                                          │
┌───▼─────────────┐              ┌────────────▼──────┐
│ ProviderFactory │              │ Router + Strategy  │
│ (Instantiation) │              │ (Provider Selection)│
└───┬─────────────┘              └────┬───────────────┘
    │                                  │
    │ Creates                          │ Selects
    │                                  │
    ▼                                  ▼
┌─────────────────────────────────────────────────────┐
│        Decorated Providers (Per-Provider Pair)       │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ CircuitBreaker                               │   │
│  │ ┌────────────────────────────────────────┐   │   │
│  │ │ RetryDecorator                         │   │   │
│  │ │ ┌──────────────────────────────────┐   │   │   │
│  │ │ │ Concrete Provider                │   │   │   │
│  │ │ │ (Anthropic/OpenAI/Ollama/MiniMax)│   │   │   │
│  │ │ └──────────────────────────────────┘   │   │   │
│  │ └────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
         │                           │
         │                           │
    ┌────▼──────────┐          ┌─────▼────────┐
    │  Telemetry    │          │  HTTP/SDK    │
    │  (OpenTelemetry)         │  (API Calls) │
    └────────────────┘          └──────────────┘
         │                           │
    ┌────▼───────────────────────────▼────┐
    │   External Services                  │
    │   (Prometheus, Jaeger, Providers)   │
    └──────────────────────────────────────┘
```

## Component Interaction Diagram

```
Request Flow:
┌─────────────────────────────────────────────────────────┐
│ 1. Application calls gateway.chat(request, options)     │
└─────────────────────┬───────────────────────────────────┘
                      │
         ┌────────────▼──────────────┐
         │ 2. Validate Configuration │
         │    & Request              │
         └────────────┬───────────────┘
                      │
         ┌────────────▼──────────────────────────────┐
         │ 3. Router selects provider based on:      │
         │    - Explicit provider name (if given)    │
         │    - Model prefix (anthropic::model-xyz)  │
         │    - Routing strategy (default strategy)  │
         │    - Health status check                  │
         └────────────┬───────────────────────────────┘
                      │
         ┌────────────▼──────────────────┐
         │ 4. Start OpenTelemetry Span   │
         │    (llm.chat)                 │
         └────────────┬──────────────────┘
                      │
         ┌────────────▼──────────────────────┐
         │ 5. Apply Resilience Decorators:   │
         │    CircuitBreaker → RetryDecorator│
         │    (Check circuit state first)    │
         └────────────┬─────────────────────┘
                      │
         ┌────────────▼──────────────────────┐
         │ 6. Execute Provider Request       │
         │    - chatCompletion()             │
         │    - Handle AbortSignal           │
         │    - Extract latency metrics      │
         └────────────┬─────────────────────┘
                      │
              ┌───────┴────────┐
              │ Success        │ Failure
              ▼                ▼
       ┌──────────────┐  ┌──────────────────┐
       │ 7. Success   │  │ 7. Error Path    │
       │ Path:        │  │ - Check if       │
       │ - Record     │  │   retryable      │
       │   metrics    │  │ - Update circuit │
       │ - Return     │  │   state          │
       │   response   │  │ - Throw error    │
       └──────────────┘  └──────────────────┘
              │                  │
              └──────────┬───────┘
                         │
          ┌──────────────▼───────────────┐
          │ 8. Record Telemetry          │
          │    - End span                │
          │    - Update metrics (count,  │
          │      latency, tokens, errors)│
          │    - Export if configured    │
          └──────────────┬────────────────┘
                         │
          ┌──────────────▼───────────────┐
          │ 9. Return ChatResponse to    │
          │    Application               │
          └──────────────────────────────┘
```

## Layered Architecture

### Layer 1: API Layer (gateway.ts)

**Responsibilities:**
- Accept chat and stream requests from applications
- Coordinate configuration, routing, and telemetry
- Manage provider lifecycle (creation, disposal)
- Aggregate metrics across all providers
- Handle request-level options (timeout, signal, provider)

**Key Classes:**
- `LLMGateway`: Main facade with public methods

**Dependencies:**
- ProviderFactory
- Router
- CircuitBreaker (per-provider)
- LLMTracer, LLMMetrics

---

### Layer 2: Routing Layer (routing/)

**Responsibilities:**
- Register and track providers
- Implement provider selection strategies
- Maintain provider health status
- Route requests based on model and strategy

**Key Classes:**
- `Router`: Orchestrates selection with strategy
- `IRoutingStrategy`: Strategy interface
- `RoundRobinStrategy`: Even distribution
- `CostBasedStrategy`: Cost-optimized selection
- `CapabilityBasedStrategy`: Feature-based selection

**Selection Algorithm:**
```
1. If model has explicit provider prefix:
   → Use that provider if healthy
   → Otherwise fall back to strategy

2. Apply routing strategy:
   → Filter healthy providers
   → Apply strategy-specific logic
   → Return first match

3. If default provider specified:
   → Use as fallback

4. Error if no provider available
```

---

### Layer 3: Provider Layer (providers/)

**Responsibilities:**
- Implement LLMProvider interface
- Handle provider-specific API details
- Normalize responses to unified format
- Support streaming and tool calling
- Manage provider credentials

**Architecture Pattern:**

```
LLMProvider (interface)
    ▲
    │ Implements
    │
BaseProvider (abstract)
    ▲
    │ Extends
    │
┌───┴────────────────────────────────────┐
│                                        │
├─ AnthropicProvider (SDK-based)        │
├─ OpenAIProvider (SDK-based)           │
├─ OllamaProvider (Fetch-based)         │
├─ MiniMaxProvider (Fetch-based)        │
├─ CircuitBreaker (Decorator)           │
├─ RetryDecorator (Decorator)           │
└─ FallbackChain (Composite)            │
```

**Provider Features by Type:**

**SDK-Based (Anthropic, OpenAI):**
- Use official TypeScript/JavaScript SDKs
- Constructor takes API key
- Methods: `chatCompletion()`, `streamCompletion()`
- Automatic request/response transformation

**Fetch-Based (Ollama, MiniMax):**
- Use HTTP REST APIs
- Constructor takes base URL
- Manual HTTP client construction
- Request/response serialization

**Decorators (CircuitBreaker, RetryDecorator):**
- Wrap any LLMProvider
- Add resilience logic transparently
- Stack-able (decorator pattern)
- Example: `CircuitBreaker(RetryDecorator(ConcreteProvider))`

---

### Layer 4: Resilience Layer (resilience/)

**Responsibilities:**
- Implement fault tolerance patterns
- Prevent cascading failures (circuit breaker)
- Retry transient failures (retry decorator)
- Provide fallback redundancy (fallback chain)

**Pattern: Circuit Breaker**

```
States:
┌─────────────┐     5 failures      ┌──────────┐
│   CLOSED    ├──────────────────────>  OPEN   │
│ (Normal)    │                      │(Blocked)│
└─────────────┘                      └────┬────┘
      ▲                                    │
      │                               30s timeout
      │                                    │
      │  3 successes                       │
      │  in HALF_OPEN                      ▼
      │                              ┌───────────┐
      └──────────────────────────────┤ HALF_OPEN │
                                     │(Testing)  │
                                     └───────────┘

Metrics Tracked:
- Failure count
- Success count
- Last failure timestamp
- Last success timestamp
- Circuit opened timestamp
```

**Pattern: Retry Decorator**

```
Request → Check if retryable error?
              ├─ YES: Calculate backoff
              │       Sleep(exponential + jitter)
              │       Retry (up to 3 times)
              │       Return response
              │
              └─ NO: Throw immediately

Backoff Formula:
  baseDelay * (2 ^ attempt) + jitter * random()
  
Example (baseDelay=1s, jitter=0.2):
  Attempt 1: ~1s
  Attempt 2: ~2s
  Attempt 3: ~4s (capped at maxDelay)

Retryable Errors:
- TimeoutError
- RateLimitError
- ProviderError (with isRetryable flag)
```

**Pattern: Fallback Chain**

```
Provider Array: [A, B, C]

Request → Try A
             ├─ Success: Return response
             └─ Failure: Try B
                          ├─ Success: Return response
                          └─ Failure: Try C
                                       ├─ Success: Return response
                                       └─ Failure: Throw FallbackExhaustedError

Aggregated Capabilities:
- vision: union (true if any supports)
- tools: union (true if any supports)
- streaming: union (true if any supports)
- jsonMode: union (true if any supports)
- maxContextTokens: min (most restrictive)
- models: union (all supported models)
```

---

### Layer 5: Telemetry Layer (telemetry/)

**Responsibilities:**
- Create OpenTelemetry spans for tracing
- Record metrics for monitoring
- Export telemetry data to external systems

**OpenTelemetry Spans (llm.chat, llm.stream):**

```
Span Attributes:
- llm.provider: "anthropic" | "openai" | "ollama" | "minimax"
- llm.model: "claude-sonnet-4" | "gpt-4" | etc.
- llm.request.max_tokens: number
- llm.request.temperature: number (if set)
- llm.response.finish_reason: "stop" | "length" | "tool_calls" | etc.
- llm.usage.input_tokens: number
- llm.usage.output_tokens: number
- llm.usage.total_tokens: number

Events:
- "llm.request.start": Request initiated
- "llm.request.complete": Request completed
- "llm.error": Error occurred
```

**Metrics:**

```
llm.requests (Counter)
- Count of requests per provider
- Labels: provider, status (success/failure)
- Use: Rate monitoring, throughput tracking

llm.errors (Counter)
- Count of errors per type
- Labels: provider, error_type
- Use: Error rate dashboards

llm.latency (Histogram)
- Response time distribution
- Labels: provider
- Buckets: [50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s, 10s]
- Use: Latency percentiles, SLO tracking

llm.tokens (Counter)
- Token usage per provider
- Labels: provider, direction (input/output)
- Use: Cost tracking, quota management
```

**Export Flow:**

```
Application sends request
    ↓
LLMGateway creates span context
    ↓
Provider processes request
    ↓
Span attributes populated
    ↓
Metrics recorded
    ↓
OpenTelemetry Exporter configured in GatewayConfig
    ↓
Batch → Prometheus / Jaeger / CloudTrace
```

---

### Layer 6: Core Layer (core/)

**Responsibilities:**
- Define unified type system
- Provide error hierarchy
- Handle configuration loading and validation

**Type System:**

```
Core Types:
- ChatMessage: role, content (text|multimodal)
- ContentBlock: text or image with ImageSource
- ChatRequest: model, messages, maxTokens, optional params
- ChatResponse: id, content, toolCalls, usage, latencyMs
- StreamChunk: delta updates (text, tool_call, etc.)

Tool Support:
- ToolDefinition: function name, description, JSON schema
- ToolCall: function name and arguments (JSON string)
- Tool Responses: ChatMessage with role="tool"

Provider Metadata:
- ProviderCapabilities: streaming, tools, vision, jsonMode, maxContextTokens
- ProviderName: const union ["anthropic", "openai", "ollama", "minimax"]
```

**Configuration Loading:**

```
Priority Order (highest to lowest):
1. Constructor config parameter
2. Environment variables (PROVIDER_NAME_*_*)
3. Defaults (from DEFAULT_* constants)

Example:
  env.ANTHROPIC_API_KEY
  → AnthropicProvider gets { apiKey: value }
  
  config.providers.anthropic.baseUrl
  → Overrides ANTHROPIC_BASE_URL env var
```

---

## Data Flow Diagrams

### Chat Request Flow

```
ChatRequest
├── model: "claude-sonnet-4-20250514"
├── messages: [{ role: "user", content: "Hello" }]
├── maxTokens: 1024
└── temperature: 0.7

    ↓ Normalize across providers

Provider-Specific Request (e.g., Anthropic SDK)
├── model: "claude-sonnet-4-20250514"
├── system?: string
├── messages: [{ role: "user", content: "Hello" }]
├── max_tokens: 1024
└── temperature: 0.7

    ↓ Execute API call

Provider-Specific Response (e.g., Anthropic SDK)
├── id: "msg_xxx"
├── content: [{ type: "text", text: "Hi there!" }]
├── usage: { input_tokens: 10, output_tokens: 5 }
└── stop_reason: "end_turn"

    ↓ Normalize to unified format

ChatResponse
├── id: "msg_xxx"
├── content: "Hi there!"
├── toolCalls: []
├── usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 }
├── model: "claude-sonnet-4-20250514"
├── finishReason: "stop"
└── latencyMs: 345
```

### Streaming Flow

```
StreamRequest
├── model: string
├── messages: ChatMessage[]
└── ...

    ↓ Router selects provider

Provider.streamCompletion()
    ↓
    ├─ Chunk 1: { type: "text", text: "Hello" }
    ├─ Chunk 2: { type: "text", text: " world" }
    ├─ Chunk 3: finishReason: "stop", usage: {...}
    └─ (Provider-specific event stream)

    ↓ Normalize each chunk

StreamChunk
├── id: "chatcmpl_xxx_0"
├── delta: { type: "text", text: "Hello" }
└── finishReason?: "stop" (final chunk only)

    ↓ Yield to application

for await (const chunk of gateway.stream(request)) {
  console.log(chunk.delta.text);
}
```

---

## Error Handling Architecture

```
LLMError (Base)
├── Code: string identifier
├── Message: human-readable description
├── isRetryable: boolean flag
└── Cause: original error (if wrapped)

┌─────────────────────────────────────┐
│ Application catches specific errors │
│ and reacts appropriately            │
└─────────────────────────────────────┘
         ▲                 ▲
         │                 │
    ┌────┴─────────┐   ┌───┴────────────┐
    │ Retryable    │   │ Non-Retryable  │
    │ - Timeout    │   │ - Auth Error   │
    │ - RateLimit  │   │ - Model 404    │
    │ - Provider   │   │ - ContentFilter│
    │   Error      │   │ - Validation   │
    └─────────────┘   └────────────────┘
         │                 │
    Retry with            Fail fast
    exponential           (don't retry)
    backoff

Circuit Breaker Integration:
  Provider Error → Circuit records failure
                → If threshold exceeded
                → Circuit opens (OPEN state)
                → All future calls fail immediately (CircuitOpenError)
                → After timeout, try HALF_OPEN
                → If recovery, return to CLOSED
```

---

## Deployment Architecture

### Single Gateway Instance

```
┌──────────────────────────────┐
│  Application Code            │
│  (Node.js / TypeScript)      │
└───────────────┬──────────────┘
                │
        ┌───────▼────────┐
        │ LLMGateway     │
        │ (in process)   │
        └───────┬────────┘
                │
        ┌───────▼─────────────────┐
        │ Multiple Providers      │
        │ (with SDK or HTTP)      │
        └───────┬─────────────────┘
                │
    ┌───────────┼───────────┬───────────┐
    ▼           ▼           ▼           ▼
 Anthropic   OpenAI     Ollama      MiniMax
    │           │           │           │
    └───────────┼───────────┼───────────┘
                │
        ┌───────▼────────────────┐
        │ OpenTelemetry Exporter │
        │ (if configured)        │
        └───────┬────────────────┘
                │
        ┌───────▼────────────────┐
        │ Monitoring Backend     │
        │ (Prometheus/Jaeger)    │
        └────────────────────────┘
```

### Multi-Region Deployment

```
┌─────────────────────────────────────┐
│ Region A                            │
│  ┌──────────────────────────────┐   │
│  │ LLMGateway (Round-Robin)     │   │
│  │  ├─ Anthropic              │   │
│  │  ├─ OpenAI (local cache)   │   │
│  │  └─ Ollama (local model)   │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
         │
         │ (Application decides routing)
         │
┌─────────────────────────────────────┐
│ Region B                            │
│  ┌──────────────────────────────┐   │
│  │ LLMGateway (Cost-Based)      │   │
│  │  ├─ OpenAI (primary)        │   │
│  │  ├─ MiniMax (fallback)      │   │
│  │  └─ Ollama (local model)    │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘

Central Monitoring:
- Single telemetry exporter ingests all regions
- Metrics aggregated per region and provider
- Circuit breaker state tracked independently per region
```

---

## State Management

### Circuit Breaker State Machine

```
Event: Success
  CLOSED ←→ HALF_OPEN → CLOSED (3 successes)
    ↓ (5 failures)
   OPEN
    ↓ (30s timeout)
 HALF_OPEN

Event: Failure
  CLOSED → (count++) → OPEN (if count >= 5)
  HALF_OPEN → OPEN (restart counter)
  OPEN → (no change)

Query: getMetrics()
  {
    state: "half_open",
    failures: 2,
    successes: 1,
    lastFailure: Date,
    openedAt: Date
  }
```

### Provider Health Tracking

```
Router maintains per-provider:
├── health: boolean (true = healthy)
├── circuitBreaker: CircuitBreaker instance
└── lastStatusChange: Date

Router methods:
├── markHealthy(name)
├── markUnhealthy(name)
├── isHealthy(name): boolean

Selection filters to healthy providers only
```

---

## Performance Characteristics

| Operation | Time | Space | Notes |
|-----------|------|-------|-------|
| gateway.chat() | ~100ms-5s | O(1) | Depends on provider latency |
| Provider selection | <1ms | O(n) | n = provider count (usually 4-10) |
| Circuit breaker check | <1μs | O(1) | State lookup in Map |
| Retry backoff calc | <1ms | O(1) | Exponential formula |
| Latency buffer insert | <1μs | O(1) | Circular buffer, fixed size |
| Metric recording | <1μs | O(1) | Counter increment |
| Span creation | <1ms | O(1) | OpenTelemetry SDK |

---

## Extensibility Points

### Adding a New Provider

1. Extend `BaseProvider`
2. Implement `chatCompletion()` and `streamCompletion()`
3. Define `capabilities()` and `models`
4. Register in `ProviderFactory`
5. Update type definitions

### Adding a Custom Routing Strategy

1. Implement `IRoutingStrategy`
2. Return selected `LLMProvider`
3. Pass to `Router` or `LLMGateway` config

### Custom Resilience Pattern

1. Implement `LLMProvider` interface
2. Wrap another provider
3. Add custom logic in `chatCompletion()` or `streamCompletion()`
4. Add to gateway initialization chain

### Custom Telemetry Export

1. Create OpenTelemetry exporter
2. Pass to `LLMGateway` config
3. Export receives metric and trace events automatically
