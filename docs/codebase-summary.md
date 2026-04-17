# LLM Gateway - Codebase Summary

**Last Updated:** April 17, 2026  
**Current Version:** 1.0.0  
**Project Type:** pnpm monorepo (4 packages)

## Monorepo Structure

```
ai-connect/                        # Root workspace
├── llm-gateway/                   # Core LLM provider gateway package
├── llm-shared/                    # Internal shared types (WebSocket, auth)
├── llm-http/                      # HTTP server wrapper (planned)
├── llm-db/                        # Database integration (planned)
└── pnpm-workspace.yaml            # Workspace configuration
```

## Package Details

### 1. llm-gateway (Core Package)
Main LLM provider abstraction with 44 TypeScript files:

```
llm-gateway/src/
├── core/                      # Type system and configuration
│   ├── types.ts              # Unified message, request, response types
│   ├── errors.ts             # Error hierarchy
│   ├── config.ts             # Configuration loading and validation
│   └── __tests__/            # Core tests
│
├── providers/                # LLM provider implementations
│   ├── llm-provider.ts       # Provider interface definition
│   ├── base-provider.ts      # Abstract base with common utilities
│   ├── anthropic-provider.ts # Anthropic Claude implementation
│   ├── openai-provider.ts    # OpenAI GPT implementation
│   ├── ollama-provider.ts    # Ollama local model implementation
│   ├── minimax-provider.ts   # MiniMax API implementation
│   └── __tests__/            # Provider tests
│
├── factory/                  # Provider instantiation
│   ├── provider-factory.ts   # Factory with registry and caching
│   └── __tests__/            # Factory tests
│
├── routing/                  # Provider selection strategies
│   ├── router.ts             # Router orchestration
│   ├── routing-strategy.ts   # Strategy interface
│   ├── strategies/           # Concrete strategies
│   │   ├── round-robin-strategy.ts
│   │   ├── cost-based-strategy.ts
│   │   └── capability-based-strategy.ts
│   └── __tests__/            # Routing tests
│
├── resilience/               # Fault tolerance patterns
│   ├── circuit-breaker.ts    # CLOSED/OPEN/HALF_OPEN states
│   ├── retry-decorator.ts    # Exponential backoff retry
│   ├── fallback-chain.ts     # Sequential provider fallback
│   └── __tests__/            # Resilience tests
│
├── telemetry/                # Observability integration
│   ├── tracer.ts             # OpenTelemetry span creation
│   ├── metrics.ts            # Metric collection and export
│   └── __tests__/            # Telemetry tests
│
├── gateway.ts                # Main gateway facade
├── index.ts                  # Public API exports
└── __tests__/                # Gateway tests
```

## Core Modules

### 1. Type System (`core/types.ts`)

**Unified Message Format:**
- `ChatMessage`: role (system/user/assistant/tool), content (text or multimodal)
- `ContentBlock`: Text or image content with MIME types
- `ImageSource`: Base64 or URL-based image data

**Request/Response:**
- `ChatRequest`: model, messages, maxTokens, temperature, tools, responseFormat
- `ChatResponse`: id, content, toolCalls, usage, finishReason, latencyMs
- `StreamChunk`: Incremental delta updates (text, tool_call_start, tool_call_delta)

**Tool Support:**
- `ToolDefinition`: Function definition with JSON schema parameters
- `ToolCall`: Assistant's function invocation with parsed arguments

**Provider Metadata:**
- `ProviderCapabilities`: streaming, tools, vision, jsonMode, maxContextTokens
- `ProviderName`: Const union of supported providers

### 2. Error Hierarchy (`core/errors.ts`)

```
LLMError (base)
├── ProviderError          // Provider-specific failures
├── RateLimitError         // Rate limiting
├── AuthenticationError    // Auth failures
├── TimeoutError           // Request timeout
├── CircuitOpenError       // Circuit breaker tripped
├── FallbackExhaustedError // All fallback providers failed
├── ModelNotFoundError     // Model not supported
├── ContentFilterError     // Content policy violation
└── ValidationError        // Input validation failure
```

**Inheritance:** All extend `LLMError` with code and isRetryable flag.

### 3. Configuration (`core/config.ts`)

**GatewayConfig Interface:**
- `providers`: Map of provider names to configs
- `defaultProvider`: Provider to use when not explicitly selected
- `retry`: Retry policy (maxRetries, baseDelay, maxDelay)
- `circuitBreaker`: CB settings (failureThreshold, resetTimeout, probeRequests)
- `timeoutMs`: Global request timeout
- `telemetry`: OpenTelemetry exporter configuration

**Features:**
- Environment variable merging (e.g., `ANTHROPIC_API_KEY`)
- Config validation at startup
- Provider-specific overrides
- Sensible defaults provided

### 4. LLMProvider Interface (`providers/llm-provider.ts`)

**Contract:**
```typescript
interface LLMProvider {
  readonly name: ProviderName
  readonly models: string[]
  capabilities(): ProviderCapabilities
  supportsModel(model: string): boolean
  chatCompletion(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>
  streamCompletion(request: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamChunk>
  dispose(): Promise<void>
}
```

**Implemented By:**
- CircuitBreaker (wraps provider)
- RetryDecorator (wraps provider)
- FallbackChain (coordinates multiple)
- Concrete providers (Anthropic, OpenAI, Ollama, MiniMax)

### 5. BaseProvider (`providers/base-provider.ts`)

**Utilities:**
- `supportsModel()`: Wildcard matching (e.g., `claude-*`)
- `validateRequest()`: Parameter validation (temp, topP ranges)
- `checkAbort()`: Abort signal handling
- `startTiming()` / `getLatency()`: Latency measurement
- `generateRequestId()`: Unique request tracking

**Protocol:**
- Subclasses implement `chatCompletion()` and `streamCompletion()`
- Both must handle abort signals and timing
- Validation happens before provider call

### 6. Concrete Providers

**AnthropicProvider (`anthropic-provider.ts`)**
- SDK-based implementation
- Models: claude-opus*, claude-sonnet*, claude-haiku*
- Capabilities: streaming ✓, tools ✓, vision ✓, jsonMode ✗, maxContext 200K
- Multimodal message handling with vision support
- Tool response routing

**OpenAIProvider (`openai-provider.ts`)**
- SDK-based implementation
- Models: gpt-4*, gpt-3.5-turbo*
- Capabilities: streaming ✓, tools ✓, vision ✓, jsonMode ✓, maxContext 128K
- JSON mode and structured output support
- Parallel tool calling

**OllamaProvider (`ollama-provider.ts`)**
- Fetch-based (REST API)
- Configurable base URL (default: http://localhost:11434)
- Supports any installed Ollama model
- Capabilities: streaming ✓, tools ✓, vision ✓, jsonMode ✓, maxContext 128K
- Local model inference without API keys

**MiniMaxProvider (`minimax-provider.ts`)**
- Fetch-based (REST API)
- Models: abab6.5t, abab6-32k, abab7, abab8
- Capabilities: streaming ✓, tools ✗, vision ✗, jsonMode ✗, maxContext 245K
- Simple request-response flow, no tool support
- Cost-effective for text-only tasks

### 7. ProviderFactory (`factory/provider-factory.ts`)

**Registry Pattern:**
- Static provider registry mapping names to configurations
- Instance caching (one instance per provider name)
- Lazy creation on first access

**Operations:**
- `create(name)`: Instantiate provider with config
- `createBulk(names)`: Create multiple providers
- `get(name)`: Retrieve cached instance
- `getAll()`: List all registered providers
- `dispose()`: Clean up resources

**Features:**
- Automatic provider initialization from config
- Reuse instances across gateway instances
- Type-safe provider selection

### 8. Router (`routing/router.ts`)

**Responsibilities:**
- Register/unregister providers
- Track health status per provider
- Select provider using strategy
- Handle default provider fallback

**Selection Logic:**
1. Extract provider from model name (e.g., `anthropic::model`)
2. Use strategy to select from healthy providers
3. Apply default provider if no explicit selection
4. Throw if no suitable provider available

**Health Management:**
- `markHealthy()` / `markUnhealthy()`: Update status
- `isHealthy()`: Query status
- Strategies only consider healthy providers

### 9. Routing Strategies

**RoundRobinStrategy (`strategies/round-robin-strategy.ts`)**
- Counter-based cycling through providers
- Load distributes evenly
- Resets at provider count

**CostBasedStrategy (`strategies/cost-based-strategy.ts`)**
- Cost per 1000 tokens configurable per provider
- Prioritizes cheapest available provider
- Falls back to round-robin if costs equal

**CapabilityBasedStrategy (`strategies/capability-based-strategy.ts`)**
- Validates request requirements against provider capabilities
- Matches: vision, tools, jsonMode, context length
- Selects first capable provider (round-robin among matches)

### 10. CircuitBreaker (`resilience/circuit-breaker.ts`)

**States:**
- `CLOSED`: Normal operation, requests pass through
- `OPEN`: Provider failed threshold, requests fail fast
- `HALF_OPEN`: Testing recovery with limited probe requests

**Metrics:**
- Failure/success counts
- State transition timestamps
- Last failure and success times

**Configuration:**
- `failureThreshold`: Failures to trigger OPEN (default 5)
- `resetTimeout`: Duration in OPEN before HALF_OPEN (default 30s)
- `probeRequests`: Successful probes to return CLOSED (default 3)

### 11. RetryDecorator (`resilience/retry-decorator.ts`)

**Behavior:**
- Transparent retry wrapper around provider
- Selective: Only retries TIMEOUT, RATE_LIMIT, PROVIDER_ERROR
- Exponential backoff: baseDelay * (2 ^ attempt) + jitter

**Configuration:**
- `maxRetries`: Max attempt count (default 3)
- `baseDelayMs`: Initial backoff (default 1000ms)
- `maxDelayMs`: Backoff ceiling (default 10000ms)
- `jitterFactor`: Random backoff component (default 0.2)

**Features:**
- Preserves abort signals and cancellation
- Respects timeout remaining for each attempt
- Logs retry attempts for debugging

### 12. FallbackChain (`resilience/fallback-chain.ts`)

**Protocol:**
- Takes array of providers
- Attempts sequentially until success
- Throws `FallbackExhaustedError` if all fail

**Capabilities Aggregation:**
- Combines capabilities from all providers
- Supports vision if any provider supports it
- Union of supported models
- Max context is minimum across all

**Useful For:**
- Guaranteed availability with redundancy
- Cost optimization (try cheap first, then expensive)
- Feature-specific routing (try vision-enabled, then fallback)

### 13. OpenTelemetry Integration

**LLMTracer (`telemetry/tracer.ts`)**
- Creates spans for `llm.chat` and `llm.stream` operations
- Attributes: model, provider, request tokens, response tokens
- Follows GenAI semantic conventions

**LLMMetrics (`telemetry/metrics.ts`)**
- Counter: `llm.requests` (total per provider)
- Counter: `llm.errors` (by error type)
- Histogram: `llm.latency` (response time distribution)
- Counter: `llm.tokens` (input/output usage)

**Configuration:**
- Accepts OpenTelemetry SDK exporter instance
- Automatic metric export based on exporter configuration

### 14. Main Gateway (`gateway.ts`)

**Initialization:**
- Validates configuration
- Creates provider factory and router
- Sets up circuit breakers per provider
- Initializes telemetry (tracer and metrics)

**Public API:**
- `chat()`: Single request with response
- `stream()`: Streaming response with chunked deltas
- `getProvider()` / `getProviderNames()`: Provider introspection
- `isProviderHealthy()`: Health status check
- `getMetrics()`: Aggregated metrics
- `createFallbackChain()`: Ad-hoc fallback
- `dispose()`: Resource cleanup

**Request Options:**
- `provider`: Explicit provider selection
- `timeout`: Per-request timeout override
- `signal`: Abort signal for cancellation

**Metrics Tracking:**
- Circular buffer for latency samples (1000 max)
- Aggregated across all providers
- Per-provider circuit breaker state

## Testing Structure

Each module has `__tests__` directory with vitest suite:
- Unit tests for isolated components
- Integration tests for gateway
- Error path testing
- Concurrent request handling
- Fallback chain sequencing

## Key Patterns

**Provider Decorator Pattern:**
- CircuitBreaker wraps provider (state machine)
- RetryDecorator wraps provider (retry logic)
- Both implement LLMProvider interface
- Composable: Can stack decorators

**Router Strategy Pattern:**
- IRoutingStrategy interface defines selection logic
- Concrete strategies: RoundRobin, CostBased, CapabilityBased
- Router delegates to strategy, handles defaults

**Factory with Registry:**
- Static factory per provider
- Configuration-driven instantiation
- Caching for instance reuse

**Error Handling Hierarchy:**
- Specific error types for different failures
- `isRetryable` flag determines handling
- Code field for programmatic handling

## Type Safety

- Full TypeScript strict mode enabled
- No `any` types (minimal necessary casts)
- Generic constraints on provider types
- Union types for capabilities (streaming, tools, vision)
- Const assertions for readonly arrays

## Dependency Management

**Production:**
- `@anthropic-ai/sdk`: Anthropic API client
- `openai`: OpenAI API client
- `@opentelemetry/api`: Telemetry interface

**Development:**
- `tsx`: TypeScript execution
- `vitest`: Unit testing
- `@types/*`: TypeScript definitions

## Performance Considerations

1. **Circular Latency Buffer**: O(1) insertion for 1000 samples
2. **Provider Caching**: No re-instantiation per request
3. **Lazy Initialization**: Providers created on-demand
4. **Circuit Breaker**: Fail-fast to prevent cascading failures
5. **Streaming**: Yields chunks immediately (no buffering)
6. **Metrics**: Counters updated in-place (no lock contention)

## Security Considerations

1. **API Key Management**: Environment variable based, never logged
2. **Abort Handling**: Respects cancellation signals
3. **Validation**: Input parameters validated before provider call
4. **Error Messages**: Sanitized to avoid exposing provider details
5. **Timeout Protection**: Prevents hanging requests

## Extensibility

**Adding New Provider:**
1. Extend `BaseProvider`
2. Implement `chatCompletion()` and `streamCompletion()`
3. Define `models` and `capabilities()`
4. Register in `ProviderFactory`
5. Add configuration interface

**Custom Routing Strategy:**
1. Implement `IRoutingStrategy`
2. Return selected `LLMProvider`
3. Pass to `Router` configuration

**Custom Resilience:**
1. Wrap provider implementing `LLMProvider`
2. Decorate `chatCompletion()` / `streamCompletion()`
3. Add to gateway initialization

---

## 2. llm-shared Package

Internal types-only package for shared TypeScript definitions across monorepo packages.

**Purpose:** Centralize common types (WebSocket messages, auth) to prevent duplication and ensure consistency across llm-gateway, llm-http, and future packages.

**Files:**
```
llm-shared/src/
├── types/
│   ├── ws-messages.ts    # WebSocket protocol (ClientMessage, ServerMessage)
│   ├── auth.ts           # Auth types (User, JWTPayload)
│   └── re-exports.ts     # Re-exports from llm-gateway (ChatMessage, TokenUsage, FinishReason)
├── index.ts              # Public exports
└── __tests__/            # Type verification tests (if needed)
```

**Exported Types:**

**WebSocket Protocol (`ClientMessage`, `ServerMessage`):**
```typescript
ClientMessage
  | { type: "chat"; id: string; model: string; messages: ChatMessage[]; maxTokens?: number; temperature?: number }
  | { type: "ping"; id?: string }

ServerMessage
  | { type: "chunk"; id: string; delta: string }
  | { type: "done"; id: string; usage: TokenUsage; finishReason: FinishReason }
  | { type: "error"; id?: string; code: string; message: string }
  | { type: "pong"; id?: string }
```

**Auth Types:**
- `User`: { id, username }
- `JWTPayload`: { sub, username, iat, exp }

**Re-exports from llm-gateway:**
- `ChatMessage`: Unified message format
- `TokenUsage`: Token count information
- `FinishReason`: Request completion reason

**Dependency:** Depends on `llm-gateway` workspace package for core types.

**Usage:** Import shared types from `@ai-connect/shared` instead of duplicating definitions across packages.

---

## 3. llm-http Package (Planned)

HTTP server wrapper providing REST API interface to llm-gateway.

**Status:** Pending implementation

---

## 4. llm-db Package (Planned)

Database integration layer for conversation storage and persistence.

**Status:** Pending implementation
