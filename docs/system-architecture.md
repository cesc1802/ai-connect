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
│       ├── Event-driven WebSocket v2 (/ws/chat/v2)
│       ├── Dependency injection container
│       └── Route handlers (health, auth, chat)
│
└── @ai-connect/db
    └── Postgres + Drizzle persistence layer
        ├── Database client factory
        ├── Typed schema (workspaces, users, conversations, messages)
        ├── Migration CLI tools
        └── Conversation & message repository backing
```

**Type Sharing Strategy:**
- `@ai-connect/shared` centralizes common types to prevent duplication
- Packages depend on `llm-gateway` and `@ai-connect/shared` for type definitions
- WebSocket protocol types decouple HTTP server from gateway internals

**Dependency Flow:**

```
llm-http
├── llm-gateway (for chat operations)
├── @ai-connect/shared (for types)
└── @ai-connect/db (for persistence)

@ai-connect/db
└── (no internal dependencies — owns its own schema and migrations)
```

---

## Workspace Detail + Org Template Management

**Workspace Detail Feature (Members / Templates / Providers Tabs):**

**Overview:** Workspace admins manage members, attach prompt templates, and configure providers from a detail screen. Org admins manage the shared prompt-template library via a dedicated templates screen.

**Workspace Detail Feature Scope:**
- Members: Add/remove users, assign workspace-scoped roles (wsadmin, pm, ba, qa, dev)
- Templates: Attach/detach organization prompt templates to workspace (admin-only mutations)
- Providers: Enable/disable LLM providers at workspace level (admin-only mutations)

**Org Template Library CRUD Scope (full admin-only):**
- Create: POST title (1–80), category (1–40), icon (1–40), description (1–280), body (≤8000, optional/nullable)
- Read: GET library (any authenticated user) or admin-only library management
- Update: PATCH ≥1 field (admin-only)
- Delete: DELETE (admin-only, 409 `template_in_use` if attached to workspace via FK restrict)
- Slug auto-generation: `tpl-<uuid>` on create, author resolved from JWT

**Nested Resource Architecture:**
```
/prompt-templates            → GET (any auth), POST/PATCH/DELETE (admin-only, full CRUD)

/workspaces/:id/
├── /members                  → GET (list), POST (add), /members/candidates (admin)
│   └── /:userId             → PATCH (update roles), DELETE
├── /providers               → GET (list), /providers/:providerId (PATCH enable/disable)
└── /templates               → GET (list), POST (attach), DELETE /:templateId
```

**Key Implementation Details:**

*Database Layer:*
- `promptTemplates` table: Org-wide mutable library (title, category, icon, description, body nullable, author_name, uses counter, slug unique)
- Migration: `0003_prompt_template_body.sql` adds nullable `body` text column
- `workspaceTemplates` join: workspace_id + template_id composite PK with cascade delete (deleting template → detach from all workspaces)
- All endpoints use Drizzle ORM repositories with role-aware access control
- `WorkspaceTemplatesRepository` gains `createTemplate`, `updateTemplate`, `deleteTemplate` + `TemplateInUseError` exception

*HTTP Layer:*
- `prompt-templates-routes.ts`: Full CRUD router (GET org library any-auth, POST/PATCH/DELETE admin-only); returns 201 on create, 404 on missing, 409 on FK constraint
- Members/Providers/Templates routes mounted as nested routers in `workspace-by-id-routes.ts`
- Access control: reads by members (404 for non-members), mutations by admin-only
- 409 conflict on duplicate role assignment (deduped in Zod before persist)
- Zod validation: title/category/icon/description ranges, body ≤8000, blank body normalized to null, PATCH requires ≥1 field
- 404 leak-safe: non-member workspace queries return 404 not 403

*Frontend Layer:*
- Org template admin screen: `templates-screen.tsx` (list, search by title/description, client-side paging 9/page, create/edit dialogs, delete confirms)
- Workspace detail screen: `workspace-detail-screen.tsx` (Members/Templates/Providers/Settings 4-tab interface)
- Template management components: `template-card.tsx` (admin edit UI), `template-dialog.tsx` (create/edit with live preview + 12-icon picker + mono body textarea), `template-delete-dialog.tsx` (delete confirm with 409 error inline)
- API client: `prompt-templates-api.ts` (createTemplate, updateTemplate, deleteTemplate, listTemplateLibrary)
- Real-time sync via sequential API calls (no polling)

---

## Persistence Layer Architecture (@ai-connect/db)

The persistence layer provides Postgres-backed storage for conversations, messages, and workspace metadata using Drizzle ORM.

### Overview

- **Technology:** Drizzle 0.36 + postgres-js driver + PostgreSQL 16
- **Database Client:** `createDbClient(url, poolMax)` factory returns `{ db, sql, close() }`
- **Schema:** Fully typed with inferred row types from definitions
- **Migrations:** Forward-only SQL generated from schema changes; tracked in `_drizzle_migrations` table

### Data Model

```
┌──────────────────────────────────────┐
│      Workspace Hierarchy              │
├──────────────────────────────────────┤
│ workspaces (id, slug, name)          │
│   └─ user_workspaces (user, workspace)
│   └─ user_role_workspaces (role grants)
│   └─ workspace_providers (provider overrides)
│   └─ workspace_templates (templates attached)
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│      Chat History                     │
├──────────────────────────────────────┤
│ conversations (id, workspace, user, title)
│   └─ messages (id, conversation, role, content)
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│      Prompt Template Library          │
├──────────────────────────────────────┤
│ prompt_templates (org library)       │
│   ├─ slug (unique)                   │
│   ├─ title, category, icon           │
│   ├─ author_name, uses               │
│   ├─ description                     │
│   └─ body (nullable, ≤8000 chars)   │
│                                      │
│ workspace_templates (join)           │
│   └─ (workspace_id, template_id) PK  │
│      with cascade delete              │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│      Provider Configuration           │
├──────────────────────────────────────┤
│ provider_catalogs (registry)         │
│ providers (instances)                │
│ usage_metrics (quota tracking)       │
└──────────────────────────────────────┘
```

### Scope (Chat History)

**Implemented (Phase 7):**
- Conversation storage with workspace/user scoping
- Message persistence with role and content
- Drizzle-backed `ConversationRepository` and `MessageRepository`

**Schema Defined, Not Persisted:**
- Admin workspace/user CRUD (in-memory only)
- Quota enforcement (schema exists; logic in-memory)
- Audit logging (schema exists; not persisted)

### Migration Workflow

```
1. Edit schema file (llm-db/src/schema/*.ts)
         ↓
2. pnpm db:generate
   - Compiles TypeScript to dist/schema/index.js
   - Runs drizzle-kit generate against compiled schema
   - Emits SQL migration file
         ↓
3. Review generated SQL in llm-db/drizzle/
         ↓
4. pnpm db:migrate
   - Reads migrations in numeric order
   - Applies to Postgres via drizzle-orm migrator
   - Records hash in _drizzle_migrations table
         ↓
5. Production: node llm-db/dist/cli/migrate.js before boot
```

**Key Detail:** `pnpm db:generate` automatically compiles TypeScript first because drizzle-kit reads the compiled `.js` output (not source `.ts`), which uses Node's ESM import resolution.

### Connection Lifecycle

```typescript
// Boot: Create client with environment variables
const client = createDbClient({
  url: process.env.DATABASE_URL,    // Required
  poolMax: process.env.DATABASE_POOL_MAX ?? 10,
});

// Use: Access typed Drizzle instance
const convos = await client.db.query.conversations.findMany();

// Shutdown: Close connection pool
await client.close();
```

### Error Handling

- **Connection Errors** — Postgres unavailable on startup → app fails to boot
- **Migration Errors** — Schema drift detected by `drizzle-kit check` → CI fails fast
- **Query Errors** — Runtime SQL failures propagate; not caught by migration layer

### Deployment Pattern

**Pre-boot migrations ensure safety:**

```bash
# In container startup script:
node llm-db/dist/cli/migrate.js  # Apply all pending migrations
node llm-http/dist/index.js      # Start app after DB is ready
```

If migrations fail, app does not boot (safe failure). If app is already running and new migrations fail, they must be resolved manually before app restart.

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
| `/workspaces` | GET | User | No | List workspaces (paginated, role-aware) | ✅ |
| `/workspaces` | POST | System Admin | No | Create workspace | ✅ |
| `/ws/chat/v2` | Upgrade | Query Token | No | Event-driven WebSocket | ✅ |

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

### Layer 3: Event-Driven WebSocket v2 (`/ws/chat/v2`)

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

### Layer 4: Rate Limiting (shared/rate-limit.ts)

**Responsibilities:**
- Apply request throttling to protect endpoints
- Track requests by IP address (login) or user ID (chat)
- Return standardized rate limit responses
- Work correctly in production (reverse proxy) scenarios

**Rate Limit Configuration:**

| Endpoint | Key | Limit | Window | Config Variable |
|----------|-----|-------|--------|-----------------|
| `/auth/login` | Client IP | 5 | 15 minutes | `RATE_LIMIT_LOGIN_*` |

**Environment Variables:**

```bash
RATE_LIMIT_LOGIN_WINDOW_MS=900000      # 15 minutes (default)
RATE_LIMIT_LOGIN_MAX=5                 # 5 attempts (default)
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

### Layer 5: Authentication Layer (auth/)

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

### Layer 6: Data Access Layer (auth/)

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

### Layer 7: Dependency Injection Layer (container.ts)

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

**Missing Token:**

```http
GET /health HTTP/1.1

HTTP/1.1 401 Unauthorized
{
  "code": "missing_token",
  "message": "Authorization header required"
}
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
