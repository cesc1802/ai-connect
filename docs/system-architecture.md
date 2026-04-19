# LLM Gateway - System Architecture

**Last Updated:** April 19, 2026  
**Version:** 1.2.0

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

---

### Layer 6: Core Layer (core/)

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

## Monorepo Package Architecture

The project is organized as a pnpm monorepo with shared types and multiple runtime packages:

```
Monorepo (ai-connect)
├── @ai-connect/shared
│   └── Shared types
│       ├── WebSocket protocol (ClientMessage, ServerMessage)
│       ├── Auth types (User, JWTPayload)
│       └── Re-exports (ChatMessage, TokenUsage, FinishReason)
│
├── llm-gateway
│   └── Core provider abstraction
│       ├── Multi-provider support
│       ├── Resilience patterns
│       └── Observability
│
├── llm-http
│   └── REST API HTTP server
│       ├── Express application setup
│       ├── Authentication (JWT, credentials verification)
│       ├── Dependency injection container
│       └── Route handlers (health, auth, chat)
│
└── llm-db (planned)
    └── Database persistence layer
```

**Type Sharing Strategy:**
- `@ai-connect/shared` centralizes common types to prevent duplication
- Packages depend on `llm-gateway` and `@ai-connect/shared` for type definitions
- WebSocket protocol types decouple HTTP server from gateway internals

---

## HTTP Server Architecture (llm-http)

The HTTP server provides REST API endpoints for the LLM Gateway with built-in authentication and dependency injection.

### Layer 1: Application Layer (app.ts)

**Responsibilities:**
- Create Express application instance
- Register middleware (JSON body parsing, rate limiting)
- Mount route handlers
- Configure trust proxy for production
- Attach error handler

**Request Flow:**
```
HTTP Request
    ↓
Express Middleware (JSON parsing, trust proxy)
    ↓
Rate Limiting Middleware (if applicable)
    ↓
Route Handlers (health, auth, chat)
    ↓
Error Handler (catch-all error handling)
    ↓
HTTP Response
```

**Route Configuration:**

| Route | Method | Auth | Rate Limit | Handler | Status |
|-------|--------|------|-----------|---------|--------|
| `/health` | GET | No | No | Health check endpoint | ✅ |
| `/auth/login` | POST | No | Yes (IP) | Login with credentials | ✅ |
| `/auth` | * | No | No | Auth routes | ✅ |
| `/chat` | POST | Yes | Yes (User) | REST chat request | ✅ |
| `/ws/chat` | Upgrade | Query Token | No | Legacy WebSocket streaming | ✅ |
| `/ws/chat/v2` | Upgrade | Query Token | No | Event-driven WebSocket (new) | ✅ Phase 5 |

**Production Configuration:**
- Trust proxy: Enabled (respects X-Forwarded-For header)
- JSON limit: 1MB
- Rate limiter uses Trust Proxy for accurate IP detection in reverse proxy scenarios

---

### Layer 2: WebSocket Layer (ws/)

**Responsibilities:**
- Establish secured WebSocket connections with JWT authentication
- Manage client lifecycle (connection, heartbeat, disconnection)
- Coordinate connection callbacks for message handling
- Gracefully handle server shutdown

**Components:**

1. **WebSocket Server** (`ws-server.ts`)
   - Function: `attachWebSocketServer(httpServer: Server, container: AppContainer): WebSocketHandle`
   - Creates `ws.WebSocketServer` instance with HTTP upgrade handler
   - Authenticates all upgrade requests via `authenticateUpgrade()`
   - Attaches user context to `AuthenticatedSocket`
   - Manages heartbeat interval (30s ping/pong)

2. **Upgrade Authentication** (`ws-upgrade-auth.ts`)
   - Validates JWT token from query parameter: `ws://server/chat?token=<jwt>`
   - Extracts token, verifies signature, and returns user or error
   - Fails upgrade handshake with 401 if token invalid/missing

3. **Type Definitions** (`ws-types.ts`)
   - `AuthenticatedSocket`: Extends `WebSocket` with `user` and `isAlive` properties
   - `ConnectionListener`: Callback function for new connections

**WebSocket Lifecycle:**

```
Client initiates WebSocket upgrade request
    ↓ ws://server/chat?token=<jwt>
    
HTTP upgrade event fires on server
    ↓
authenticateUpgrade() validates JWT token
    ├─ Success: Extract user payload
    └─ Failure: Write 401, destroy socket, return
    
WebSocketServer.handleUpgrade() proceeds
    ↓
AuthenticatedSocket created with user context
    ↓
"connection" event emitted
    ├─ Log connection
    ├─ Set isAlive = true
    ├─ Call registered listeners
    └─ Start monitoring for pong
    
Heartbeat interval every 30s
    ├─ Check isAlive for all clients
    ├─ Terminate if no pong (connection dead)
    └─ Send ping, set isAlive = false
    
Client responds with pong
    ↓ Set isAlive = true
    
Client disconnects
    ├─ Log disconnection
    └─ Cleanup resources
```

**Integration with Shutdown:**

```
Process receives SIGTERM/SIGINT
    ↓
Shutdown handler called
    ├─ ws.close() → Close all client connections
    ├─ server.close() → Stop accepting new HTTP/upgrade requests
    ├─ gateway.dispose() → Cleanup provider resources
    └─ process.exit(0)
```

**Error Handling:**

| Error | Cause | Response |
|-------|-------|----------|
| Invalid token | Missing or malformed JWT | 401 Unauthorized |
| Expired token | JWT expired (checked by JwtService) | 401 Unauthorized |
| Missing query param | Token not in `?token=` parameter | 401 Unauthorized |

---

### Layer 3: Chat Handler Layer (chat/)

**Responsibilities:**
- Handle WebSocket message reception and routing via Command Pattern
- Validate client messages with Zod schemas
- Manage streaming operations with abort control
- Map errors to client-friendly error codes
- Enforce backpressure and message size limits

**Components:**

1. **Command Handler Interface** (`handlers/ws-command-handler.ts`)
   - `WsCommandHandler<T extends ClientMessage>`: Generic handler interface
   - `type: T["type"]`: Message type discriminator
   - `handle(socket, msg, send, ctx): void`: Handler method signature
   - Supports type-safe dispatch via discriminated union types

2. **Handler Implementations:**
   - **ChatCommandHandler** (`handlers/chat-command-handler.ts`)
     - Handles `{ type: "chat" }` messages
     - Parses model, messages, maxTokens (default: 4096), temperature
     - Executes `StreamChatUseCase.execute()` with callbacks
     - Aborts previous stream if new chat arrives
   - **PingCommandHandler** (`handlers/ping-command-handler.ts`)
     - Handles `{ type: "ping" }` messages for keepalive
     - Responds with `{ type: "pong" }` message

3. **Message Validation** (`chat-message-validator.ts`)
   - Zod schema: `clientMessageSchema` (discriminated union)
   - Chat message schema:
     - `type: "chat"`
     - `id: string` (1-64 chars)
     - `model: string` (non-empty)
     - `messages: ChatMessage[]` (at least 1)
     - `maxTokens?: number` (1-8192, optional)
     - `temperature?: number` (0-2, optional)
   - Ping message schema:
     - `type: "ping"`
     - `id?: string` (optional)

4. **Streaming Use Case** (`stream-chat-use-case.ts`)
   - Wraps `ChatGatewayPort.stream()` with AbortController
   - Implements callbacks pattern:
     - `onChunk(delta: string)`: Emitted for each text chunk
     - `onDone(usage, finishReason)`: Final message with metrics
     - `onError(err)`: Error propagation
   - Returns `StreamHandle`:
     - `abort()`: Aborts stream via AbortController
     - `done: Promise<void>`: Completes when stream ends

5. **Error Mapping** (`error-mapper.ts`)
   - Maps typed error names to client codes:
     - `AuthenticationError` → `"provider_auth_error"`
     - `RateLimitError` → `"provider_rate_limit"`
     - `TimeoutError` → `"provider_timeout"`
     - `CircuitOpenError` → `"provider_unavailable"`
     - `FallbackExhaustedError` → `"all_providers_failed"`
     - `ValidationError` → `"invalid_request"`
     - `ModelNotFoundError` → `"model_not_found"`
     - `ContentFilterError` → `"content_filtered"`
     - `AbortError` → `"request_cancelled"`
     - Default → `"internal_error"`
   - `sanitizeErrorMessage()`: Returns generic message for internal errors

6. **Main Handler Router** (`chat-ws-handler.ts`)
   - Function: `attachChatHandler(handlers, logger): (socket) => void`
   - Creates `HandlerContext` with `activeStream: { handle: null }`
   - Validates all messages:
     - **Message size limit**: 1MB (checks `rawStr.length`)
     - **JSON parsing**: Catches JSON errors with error response
     - **Schema validation**: Uses Zod safeParse with first error reported
   - Handles dispatch:
     - Looks up handler by message type
     - Invokes `handler.handle(socket, msg, send, ctx)`
   - **Backpressure control**:
     - Checks `ws.bufferedAmount > 1MB` before sending
     - Drops message with warning log if threshold exceeded
   - Cleanup on close: Aborts active stream

**Chat Handler Flow:**

```
WebSocket message arrives
    ↓
Check size (> 1MB)
    ├─ YES: Send "message_too_large" error
    └─ NO: Continue
    
Parse JSON
    ├─ FAIL: Send "invalid_json" error
    └─ SUCCESS: Continue
    
Validate against clientMessageSchema
    ├─ FAIL: Send "invalid_message" error with first issue
    └─ SUCCESS: Continue
    
Find handler by msg.type
    ├─ NOT FOUND: Send "unknown_type" error
    └─ FOUND: Continue
    
Check backpressure (bufferedAmount > 1MB)
    ├─ EXCEEDED: Log warning, drop future message
    └─ OK: Queue response
    
Invoke handler.handle(socket, msg, send, ctx)
    ├─ ChatCommandHandler:
    │   └─ Execute stream with callbacks
    │       └─ onChunk → send({ type: "chunk" })
    │       └─ onDone → send({ type: "done" })
    │       └─ onError → send({ type: "error", code, message })
    └─ PingCommandHandler:
        └─ send({ type: "pong" })
```

**Handler Context Management:**

```typescript
interface HandlerContext {
  activeStream: { handle: StreamHandle | null };
}

// Only one stream active per connection
// New chat aborts previous stream
// Stream aborted on connection close
```

---

### Layer 3b: Event-Driven WebSocket v2 (`/ws/chat/v2`)

**Status:** ✅ Implemented (Phase 5, April 19, 2026)

**Quick Reference:** See [`event-driven-architecture.md`](./event-driven-architecture.md) for full details.

**Key Components:**
- `websocket-server.ts`: HTTP upgrade handler for `/ws/chat/v2`
- `connection-session.ts`: Per-client state machine with event subscriptions
- `chat-handler.ts`: Event-driven gateway bridge (stream lifecycle)
- `client-message-schema.ts`: Zod validation (c.chat.send, c.chat.abort, c.ping)
- `server-message-types.ts`: TypeScript defs (s.chat.started, s.chat.token, s.chat.completed, etc.)

**Message Flow:**
```
Client c.chat.send → ConnectionSession → EventBus (chat.requested)
                                             ↓
                                        ChatHandler
                                             ↓
                                    gateway.stream()
                                             ↓
                                    EventBus (s.chat.*)
                                             ↓
                                    ConnectionSession → Client
```

**Differences from v1 (`/ws/chat`):**

| Aspect | v1 | v2 |
|--------|-----|-----|
| Pattern | Command handlers | Event-driven pub/sub |
| Persistence | None | Conversation/message repos |
| Messages | `chat`, `chunk`, `done` | `c.chat.send`, `s.chat.token`, etc. |
| Abort | Signal-based | Explicit `c.chat.abort` message |

---

### Layer 4: REST Chat Endpoint (chat/chat-rest-routes.ts)

**Responsibilities:**
- Handle synchronous POST /chat requests (one-shot, non-streaming)
- Validate request body with Zod schemas
- Execute single chat request and return complete response
- Delegate to OneShotChatUseCase for business logic

**Request Validation:**

```typescript
POST /chat
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "model": "claude-sonnet-4",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "maxTokens": 4096,
  "temperature": 0.7
}
```

**Schema:**
- `model`: string, non-empty (required)
- `messages`: array of message objects (required, min 1)
  - `role`: "user" | "assistant" | "system" | "tool"
  - `content`: string or array (for multimodal)
- `maxTokens`: integer, 1-8192 (optional, default: 4096)
- `temperature`: number, 0-2 (optional)

**Response Format:**

```json
{
  "id": "msg_xxx",
  "content": "Response text",
  "toolCalls": [],
  "usage": {
    "inputTokens": 10,
    "outputTokens": 25,
    "totalTokens": 35
  },
  "model": "claude-sonnet-4",
  "finishReason": "stop",
  "latencyMs": 345
}
```

**Error Responses:**

| Code | Status | Cause |
|------|--------|-------|
| `invalid_body` | 400 | Request validation failed |
| `provider_auth_error` | 401 | Provider authentication failed |
| `provider_rate_limit` | 429 | Provider rate limit exceeded |
| `provider_timeout` | 504 | Request timeout |
| `provider_unavailable` | 503 | Circuit breaker open |
| `all_providers_failed` | 503 | All fallback providers failed |
| `model_not_found` | 400 | Model not available |
| `content_filtered` | 400 | Content policy violation |
| `internal_error` | 500 | Unexpected server error |

**Difference from WebSocket Streaming:**

| Feature | REST `/chat` | WebSocket `/chat` |
|---------|--------------|-------------------|
| Response Type | Complete response | Streaming chunks |
| Latency | Full request latency | Incremental (lower perceived latency) |
| Use Case | Quick responses, low throughput | Long-form text, real-time feedback |
| Connection | Single request-response | Persistent bidirectional |
| Cancellation | N/A (already complete) | Via abort signal |
| Backpressure | HTTP-level | Buffered amount tracking |

---

### Layer 5: Rate Limiting (shared/rate-limit.ts)

**Responsibilities:**
- Apply request throttling to protect endpoints
- Track requests by IP address (login) or user ID (chat)
- Return standardized rate limit responses
- Work correctly in production (reverse proxy) scenarios

**Rate Limit Configuration:**

| Endpoint | Key | Limit | Window | Config Variable |
|----------|-----|-------|--------|-----------------|
| `/auth/login` | Client IP | 5 | 15 minutes | `RATE_LIMIT_LOGIN_*` |
| `/chat` | User ID | 60 | 1 hour | `RATE_LIMIT_CHAT_*` |

**Environment Variables:**

```bash
RATE_LIMIT_LOGIN_WINDOW_MS=900000      # 15 minutes (default)
RATE_LIMIT_LOGIN_MAX=5                 # 5 attempts (default)
RATE_LIMIT_CHAT_WINDOW_MS=3600000      # 1 hour (default)
RATE_LIMIT_CHAT_MAX=60                 # 60 requests (default)
```

**Implementation Details:**

```typescript
// Factory function creates configured middleware
createRateLimit({
  windowMs: number,           // Time window in milliseconds
  max: number,               // Max requests per window
  keyBy?: "ip" | "user",     // Grouping strategy
  code?: string,             // Error code (default: "rate_limited")
  message?: string           // Error message
})

// For IP-based (login):
keyGenerator: (req) => req.ip ?? "anon"

// For user-based (chat):
keyGenerator: (req) => req.user?.id ?? req.ip ?? "anon"
```

**Response on Rate Limit:**

```json
HTTP/1.1 429 Too Many Requests

{
  "code": "rate_limited",
  "message": "Too many requests"
}

Headers:
RateLimit-Limit: 5
RateLimit-Remaining: 0
RateLimit-Reset: <unix-timestamp>
```

**Production Configuration (Trust Proxy):**

When deployed behind a reverse proxy:
- Express trusts `X-Forwarded-For` header for client IP
- Set `app.set("trust proxy", 1)` in production
- Rate limiter uses forwarded IP, not proxy IP
- Accurate per-client throttling across load balancers

---

### Layer 6: Authentication Layer (auth/)

**Components:**

1. **JWT Service** (`jwt-service.ts`)
   - Responsible for token signing and verification
   - Uses HS256 algorithm for cryptographic signing
   - Configuration: `JWT_SECRET`, `JWT_EXPIRES_IN`
   - Methods: `sign(user: User): string`, `verify(token: string): JWTPayload`

2. **Auth Routes** (`auth-routes.ts`)
   - Endpoint: `POST /auth/login`
   - Request body: `{ username: string, password: string }`
   - Validation: Zod schema for request validation
   - Response: `{ token: string, expiresIn: string }` or error code
   - Error codes: `invalid_body`, `invalid_credentials`

3. **Auth Middleware** (`auth-middleware.ts`)
   - Function: `createRequireAuth(container: AppContainer): RequestHandler`
   - Validates Bearer token in `Authorization` header
   - Extracts and verifies JWT payload
   - Sets `req.user` with id and username
   - Error codes: `missing_token`, `invalid_token`

4. **Credentials Verifier** (`credentials-verifier.ts`)
   - Verifies username and password against user records
   - Uses bcryptjs for password hash comparison
   - Returns `User` object on success, null on failure

**Authentication Flow:**

```
1. User calls POST /auth/login
   {
     "username": "demo",
     "password": "password"
   }
   
   ↓
   
2. Request validation via Zod schema
   
   ↓
   
3. Credentials Verifier checks username/password
   - Looks up user by username in repository
   - Compares password hash using bcryptjs.compare()
   
   ↓ Success
   
4. JWT Service signs token
   - Payload: { sub: user.id, username: user.username }
   - Expires in: config.JWT_EXPIRES_IN
   - Algorithm: HS256
   
   ↓
   
5. Return response
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "expiresIn": "24h"
   }

   ↓ Protected Route Access
   
6. Client includes in header
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   
   ↓
   
7. Auth Middleware validates token
   - Extracts token from header
   - Verifies signature with JWT_SECRET
   - Sets req.user if valid
   
   ↓ Success
   
8. Route handler executes with authenticated user
```

---

### Layer 7: Data Access Layer (auth/)

**Repository Pattern:**

```typescript
interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
}

interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
}
```

**Implementations:**

1. **In-Memory Repository** (`in-memory-user-repository.ts`)
   - Stores users in `Map<string, UserRecord>`
   - Synchronous lookups (O(1))
   - Used for development and testing
   - Populated via `seedUsers(config.DEMO_USERS)`

**User Seeding:**

```typescript
// From config: DEMO_USERS (JSON string)
[
  {
    "id": "user-1",
    "username": "demo",
    "passwordHash": "$2a$10$..." // bcrypt hash
  }
]

// Script to generate hashes:
// tsx scripts/hash-password.ts mypassword
```

---

### Layer 8: Dependency Injection Layer (container.ts)

**Container Interface:**

```typescript
export interface AppContainer {
  config: Config;
  logger: Logger;
  chatGateway: ChatGatewayPort;
  userRepository: UserRepository;
  credentialsVerifier: CredentialsVerifier;
  jwtService: JwtService;
}
```

**Initialization (`buildContainer`):**

```
1. Load configuration
   - NODE_ENV, JWT_SECRET, JWT_EXPIRES_IN
   - DEMO_USERS (user seed data)
   - Provider configs for LLM Gateway

2. Instantiate LLM Gateway (if providers configured)
   - Wrap with LlmGatewayAdapter

3. Instantiate auth services
   - Create UserRepository from seed data
   - Create CredentialsVerifier with repository
   - Create JwtService with secret and expiration

4. Return container with all services
```

**Service Dependencies:**

```
Container
├── config (injected)
├── logger (injected)
├── chatGateway
│   ├── LLMGateway (providers configured)
│   └── LlmGatewayAdapter (integration)
├── userRepository
│   └── InMemoryUserRepository (seeded)
├── credentialsVerifier
│   └── depends on: userRepository
└── jwtService
    └── depends on: config
```

---

### Error Handling Architecture

**HTTP Error Response Format:**

```json
{
  "code": "error_code",
  "message": "Human-readable message"
}
```

**Auth Errors:**

| Error Code | Status | Cause |
|-----------|--------|-------|
| `invalid_body` | 400 | Validation failed (username/password missing) |
| `invalid_credentials` | 401 | User not found or password mismatch |
| `missing_token` | 401 | Authorization header missing or invalid format |
| `invalid_token` | 401 | Token expired, signature invalid, or malformed |

---

### Configuration Requirements

**HTTP Server Environment Variables:**

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `NODE_ENV` | string | No | "development" | Environment type (development/production) |
| `PORT` | number | No | 3000 | Server listening port |
| `LOG_LEVEL` | string | No | "info" | Logging level (fatal/error/warn/info/debug/trace) |
| `JWT_SECRET` | string | Yes | - | Secret key for HS256 signing (min 32 chars) |
| `JWT_EXPIRES_IN` | string | No | "1h" | Token expiration format |
| `DEMO_USERS` | string (JSON) | No | "[]" | Initial user seed data as JSON array |
| `RATE_LIMIT_LOGIN_WINDOW_MS` | number | No | 900000 | Login rate limit window (15 minutes) |
| `RATE_LIMIT_LOGIN_MAX` | number | No | 5 | Max login attempts per window |
| `RATE_LIMIT_CHAT_WINDOW_MS` | number | No | 3600000 | Chat rate limit window (1 hour) |
| `RATE_LIMIT_CHAT_MAX` | number | No | 60 | Max chat requests per window |

**Authentication Environment Variables:**

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `JWT_SECRET` | string | Yes | Secret key for HS256 signing (min 32 chars recommended) |
| `JWT_EXPIRES_IN` | string | No | Token expiration format (default: "1h") |
| `DEMO_USERS` | string (JSON) | No | Initial user seed data as JSON array |

**Example Configuration:**

```bash
# Basic configuration
NODE_ENV="development"
PORT=3000
LOG_LEVEL="info"

# Auth configuration
JWT_SECRET="your-secret-key-at-least-32-characters-long"
JWT_EXPIRES_IN="1h"
DEMO_USERS='[{"id":"user-1","username":"demo","passwordHash":"$2a$10$..."}]'

# Rate limiting (optional - defaults shown)
RATE_LIMIT_LOGIN_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_LOGIN_MAX=5
RATE_LIMIT_CHAT_WINDOW_MS=3600000      # 1 hour
RATE_LIMIT_CHAT_MAX=60

# LLM Provider configuration (if using gateway)
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."
OLLAMA_BASE_URL="http://localhost:11434"
MINIMAX_API_KEY="..."
```

---

### Request/Response Examples

**Login Success:**

```http
POST /auth/login HTTP/1.1
Content-Type: application/json

{
  "username": "demo",
  "password": "password123"
}

HTTP/1.1 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJ1c2VybmFtZSI6ImRlbW8iLCJpYXQiOjE3MTM0MTUyMDAsImV4cCI6MTcxMzUwMTYwMH0.hO_...",
  "expiresIn": "24h"
}
```

**Login Failure (Invalid Credentials):**

```http
POST /auth/login HTTP/1.1
Content-Type: application/json

{
  "username": "demo",
  "password": "wrongpassword"
}

HTTP/1.1 401 Unauthorized
{
  "code": "invalid_credentials",
  "message": "Invalid username or password"
}
```

**Protected Route Access:**

```http
GET /chat HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

HTTP/1.1 200 OK
(route executes with authenticated user context)
```

**Missing Token:**

```http
GET /chat HTTP/1.1

HTTP/1.1 401 Unauthorized
{
  "code": "missing_token",
  "message": "Authorization header required"
}
```

**REST Chat Request (Success):**

```http
POST /chat HTTP/1.1
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "model": "claude-sonnet-4",
  "messages": [
    { "role": "user", "content": "What is 2+2?" }
  ],
  "maxTokens": 1024,
  "temperature": 0.7
}

HTTP/1.1 200 OK
{
  "id": "msg_1234567890",
  "content": "2+2=4",
  "toolCalls": [],
  "usage": {
    "inputTokens": 12,
    "outputTokens": 5,
    "totalTokens": 17
  },
  "model": "claude-sonnet-4",
  "finishReason": "stop",
  "latencyMs": 234
}
```

**REST Chat with Validation Error:**

```http
POST /chat HTTP/1.1
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "model": "",
  "messages": []
}

HTTP/1.1 400 Bad Request
{
  "code": "invalid_body",
  "message": "model: String must contain at least 1 character; messages: Array must contain at least 1 element(s)"
}
```

**Rate Limited (Too Many Chat Requests):**

```http
POST /chat HTTP/1.1
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "model": "claude-sonnet-4",
  "messages": [{ "role": "user", "content": "Hello" }]
}

HTTP/1.1 429 Too Many Requests
{
  "code": "rate_limited",
  "message": "Too many chat requests"
}

Headers:
RateLimit-Limit: 60
RateLimit-Remaining: 0
RateLimit-Reset: 1713549600
```

---

## Event-Driven v2 Architecture (New - Phase 5+)

For detailed documentation on the event-driven WebSocket v2 endpoint, see [`event-driven-architecture.md`](./event-driven-architecture.md).

**Quick Reference:**
- **Endpoint:** `/ws/chat/v2` (JWT authenticated)
- **Architecture:** Event-driven pub/sub with EventBus
- **Client Messages:** `c.chat.send`, `c.chat.abort`, `c.ping`
- **Server Messages:** `s.chat.*`, `s.conversation.*`, `s.error`, `s.pong`
- **Persistence:** Conversation and message repositories (in-memory, upgradeable to database)
- **Key Components:** EventBus, ConnectionRegistry, ChatHandler, ConnectionSession

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
