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

## 3. llm-http Package

HTTP/WebSocket server providing REST API and real-time streaming interface to the LLM Gateway.

**Status:** ✅ Implemented

**Files:**
```
llm-http/src/
├── auth/                         # Authentication layer
│   ├── jwt-service.ts           # JWT signing/verification
│   ├── credentials-verifier.ts  # Password verification
│   ├── auth-routes.ts           # POST /auth/login endpoint
│   ├── auth-middleware.ts       # Bearer token validation
│   ├── user-repository.ts       # Repository interface
│   ├── in-memory-user-repository.ts  # In-memory implementation
│   └── seed-users.ts            # User seeding from config
│
├── chat-v2/                      # Event-driven chat
│   ├── websocket-server.ts      # WebSocket server with event subscriptions
│   ├── connection-session.ts    # Single client session lifecycle
│   ├── chat-handler.ts          # Event-driven gateway bridge
│   ├── gateway-chunk-adapter.ts # Normalizes LLM chunks to stream events
│   ├── client-message-schema.ts # Zod schemas (c.chat.send, c.chat.abort, c.ping)
│   ├── server-message-types.ts  # TypeScript defs (s.chat.started, s.chat.token, etc.)
│   └── index.ts                 # Public exports
│
├── workspace/                    # Workspace CRUD (paging, admin) + detail feature
│   ├── workspace-repository.ts  # Repository interface (getById, isMember, list, create, update, softDelete)
│   ├── drizzle-workspace-repository.ts  # Postgres implementation (Drizzle ORM)
│   ├── workspace-routes.ts      # GET/POST /workspaces (paging + admin create)
│   ├── workspace-by-id-routes.ts # GET/PATCH/DELETE /workspaces/:id + mounts nested routers
│   ├── workspace-members-routes.ts # GET/POST/PATCH/DELETE /workspaces/:id/members (admin-only mutations)
│   ├── workspace-members-repository.ts # Interface + Drizzle implementation
│   ├── workspace-providers-routes.ts # GET /workspaces/:id/providers; PATCH /:providerId (admin-only)
│   ├── workspace-providers-repository.ts # Interface + Drizzle implementation
│   ├── workspace-templates-routes.ts # GET/POST/DELETE /workspaces/:id/templates (admin-only mutations)
│   ├── workspace-templates-repository.ts # Interface + Drizzle implementation (with TemplateInUseError on FK restrict)
│   ├── prompt-templates-routes.ts # GET/POST/PATCH/DELETE /prompt-templates (full CRUD; admin-only write, auth read)
│   ├── seed-prompt-templates.ts # Dev seed: 12 Vietnamese templates (NODE_ENV gated)
│   ├── active-workspace-resolver.ts # Interface for active workspace resolution
│   ├── drizzle-active-workspace-resolver.ts # Postgres-backed resolver
│   ├── active-workspace-routes.ts # GET /api/me/active-workspace
│   └── __tests__/               # Repository + routes tests
│
├── events/                       # Event system (Phase 1)
│   ├── event-bus.ts             # Pub/sub event broker
│   └── __tests__/               # Event bus tests
│
├── transport/                    # Message transport layer (Phase 2)
│   ├── connection-registry.ts   # Registry interface
│   ├── local-connection-registry.ts  # In-memory implementation
│   ├── message-router.ts        # Message routing interface
│   ├── local-message-router.ts  # In-memory router implementation
│   └── __tests__/               # Transport tests
│
├── repositories/                 # Data persistence (Phase 3)
│   ├── in-memory-conversation-repo.ts  # Conversation storage
│   ├── in-memory-message-repo.ts       # Message storage
│   ├── index.ts                 # Exports
│   └── __tests__/               # Repository tests
│
├── ws/                           # WebSocket utilities
│   └── ws-upgrade-auth.ts       # JWT auth on upgrade
│
├── health/                       # Health endpoint
│   └── health-routes.ts         # GET /health
│
├── shared/                       # Shared utilities
│   ├── rate-limit.ts            # Rate limiting factory
│   ├── cors-middleware.ts       # CORS configuration
│   └── error-handler.ts         # Express error handler
│
├── app.ts                        # Express app setup
├── config.ts                     # Environment config loading
├── container.ts                  # Dependency injection container
├── logger.ts                     # Pino logger
└── index.ts                      # Server entry point
```

**Key Features:**
- JWT authentication with bcrypt password hashing
- Rate limiting per IP (login endpoint)
- Manual DI container (no framework)
- Ports and adapters for testability

**Event-Driven Architecture:**
- EventBus pub/sub system for decoupled message flow
- ConnectionRegistry tracks active WebSocket sessions
- Local message routing for inter-module communication
- In-memory conversation and message repositories
- `/ws/chat/v2` endpoint with event-driven protocol
- ChatHandler bridges LLM gateway to event streaming
- ConnectionSession manages per-client lifecycle

**Client Message Types (v2):**
- `c.chat.send`: Start streaming chat (conversationId optional)
- `c.chat.abort`: Cancel active stream by requestId
- `c.ping`: Keepalive ping

**Server Message Types (v2):**
- `s.chat.started`: Stream initiated (requestId, conversationId, model, startedAt)
- `s.chat.token`: Token received (requestId, delta, index)
- `s.chat.completed`: Stream finished (requestId, usage, finishReason, latencyMs)
- `s.chat.failed`: Error occurred (requestId, code, message)
- `s.chat.aborted`: Stream cancelled (requestId, reason)
- `s.conversation.created`: New conversation (full Conversation object)
- `s.error`: Protocol error (code, message)
- `s.pong`: Pong response

**Workspace Management:**
- Role-aware list endpoint (admin: all; member: own workspaces only)
- Paginated: `GET /workspaces?page=1&limit=20` (default limit 20, max 100)
- Create endpoint (admin-only): `POST /workspaces` with auto-slug derivation from name
- Get single: `GET /workspaces/:id` (admin: any; member: returns 404 for non-membership to avoid existence leak)
- Update: `PATCH /workspaces/:id` (admin-only, partial: name and/or slug)
- Delete: `DELETE /workspaces/:id` (admin-only, soft-delete via deletedAt)
- Active workspace resolver: `GET /api/me/active-workspace` (user's first workspace or error)
- Repository pattern: interface + Postgres (Drizzle ORM) implementation
- Comprehensive tests for role-based access control and paging

**Workspace Detail Feature (Members/Templates/Providers Tabs):**

*New Database Tables:*
- `prompt_templates`: Org-wide template library (id, slug unique, title, category, icon, author_name, uses, description)
- `workspace_templates`: Join table linking workspaces to templates (workspace_id + template_id composite PK)
- Migration: `llm-db/drizzle/0002_prompt_template_library.sql`
- Dev seed: 12 Vietnamese templates (NODE_ENV gated, seeded in container.ts)

*New HTTP Endpoints (all under requireAuth):*
- `GET /prompt-templates` → {templates:[...]} (org library, any authenticated user)
- `GET /workspaces/:id/members` → {members:[{userId, username, wsRoles[], orgRole}]} (member-scoped, 404 for non-members)
- `GET /workspaces/:id/members/candidates` (admin-only, users not yet in workspace)
- `POST /workspaces/:id/members` {userId, roles[]} → 201; 409 member_exists; roles deduped via zod transform
- `PATCH /workspaces/:id/members/:userId` {roles[]} (admin-only); `DELETE` → 204
- `GET /workspaces/:id/providers` → {providers:[{providerId, name, keyLabel, icon, enabled}]} (member-scoped)
- `PATCH /workspaces/:id/providers/:providerId` {enabled} (admin-only)
- `GET /workspaces/:id/templates` (member-scoped); `POST` {templateId} → 201 (409 already attached); `DELETE .../templates/:templateId` → 204
- Implementation: workspace-members-routes.ts, workspace-providers-routes.ts, workspace-templates-routes.ts + repository layers; mounted in workspace-by-id-routes.ts

*New Frontend Components (llm-ui/src/components/workspace/*):*
- `workspace-detail-screen.tsx`: 4-tab screen (Members/Templates/Providers/Settings)
- `members-tab.tsx`, `role-edit-popover.tsx`, `add-member-dialog.tsx`, `ws-member-row.tsx`, `ws-role-checklist.tsx`
- `templates-tab.tsx`, `add-templates-dialog.tsx`, `ws-template-card.tsx`
- `providers-tab.tsx`, `toggle-switch.tsx`, `ws-provider-row.tsx`
- API modules: `workspace-members-api.ts`, `workspace-templates-api.ts`, `workspace-providers-api.ts`, `api-member-adapter.ts`, `workspace-types.ts`
- Member rows display username for both name and email (no email column)

**Testing:**
- 400+ tests passing (includes event-driven tests)
- 90%+ overall coverage
- No vi.mock() - uses interface-based fakes
- Test containers for all layers (auth, chat, workspace, events, transport)

---

## 4. @ai-connect/db Package (Postgres + Drizzle)

Database integration layer for conversation storage and persistence.

**Status:** ✅ Stable (chat history scope)

**ORM:** Drizzle 0.36 + drizzle-kit 0.30  
**Driver:** postgres-js 3.4.5  
**Database:** PostgreSQL 16+

**Files:**

```
llm-db/src/
├── client.ts                      # Factory: createDbClient(url, poolMax) → { db, sql, close() }
├── env.ts                         # Load DATABASE_URL, DATABASE_POOL_MAX from env
├── schema/                        # Typed schema definitions
│   ├── _audit-columns.ts         # Shared audit columns (created_at, updated_at, deleted_at)
│   ├── workspaces.ts             # Workspace table + type
│   ├── users.ts                  # User table + system role
│   ├── user-workspaces.ts        # User-workspace membership
│   ├── user-role-workspaces.ts   # Workspace-scoped roles
│   ├── conversations.ts          # Chat conversations (workspace + user scoped)
│   ├── messages.ts               # Chat messages (conversation scoped)
│   ├── provider-catalogs.ts      # LLM provider registry
│   ├── providers.ts              # Provider instances
│   ├── workspace-providers.ts    # Workspace provider overrides
│   ├── prompt-templates.ts       # Org prompt template library (slug unique, title, category, icon, author_name, uses, description, body nullable)
│   ├── workspace-templates.ts    # Workspace-template join (composite PK: workspace_id + template_id, cascade delete)
│   ├── usage-metrics.ts          # Token usage tracking
│   └── index.ts                  # Export all schema
│
├── cli/
│   └── migrate.ts                # CLI: Apply pending migrations via drizzle-orm/migrator
│
├── drizzle/                       # Generated migrations (forward-only)
│   ├── 0000_phase02_init.sql     # Phase 2: Initial 10-table schema (workspaces, users, conversations, messages, providers, etc.)
│   ├── 0001_add_user_system_role.sql # Phase 2: Add system role to users table
│   ├── 0002_prompt_template_library.sql # Add prompt_templates and workspace_templates tables
│   └── 0003_prompt_template_body.sql # Add nullable body column to prompt_templates
│
├── drizzle.config.ts             # drizzle-kit config (reads compiled dist/schema/index.js)
├── tsconfig.json                 # TypeScript build config
└── package.json                  # Scripts: build, db:generate, db:migrate, db:studio
```

**Key Features:**

- **Typed Client:** `createDbClient()` returns `{ db, sql, close() }` with full TypeScript inference
- **Schema Exports:** Tables and inferred row types available via `@ai-connect/db/schema`
- **Migrations:** Forward-only via drizzle-kit; hand-written reversal SQL when needed
- **CLI:** `pnpm db:migrate` applies pending migrations; `pnpm db:generate` compiles schema
- **Local Dev:** Docker Postgres 16 service in root `docker-compose.yml`

**Scope (This Phase):**

Persistence implemented for:
- ✅ Conversations (read/write via `ConversationRepository`)
- ✅ Messages (read/write via `MessageRepository`)
- ✅ Workspaces, users, providers schema (defined; CRUD still in-memory)

Explicitly out of scope:
- ❌ Admin workspace/org management (in-memory only)
- ❌ Quota enforcement (schema exists; logic not persisted)
- ❌ Audit log persistence (in-memory only)

**Important:** The db package is built first by `pnpm -r build`. Drizzle-kit reads the compiled `dist/schema/index.js` (not source `.ts`) for migration generation — this is why `pnpm db:generate` runs `tsc` automatically before `drizzle-kit generate`.

**Connection Pattern:**

```typescript
import { createDbClient } from "@ai-connect/db";

const client = createDbClient({
  url: process.env.DATABASE_URL!,
  poolMax: Number(process.env.DATABASE_POOL_MAX ?? 10),
});

// Use client.db (Drizzle ORM instance)
const conversations = await client.db.query.conversations.findMany();

// On shutdown
await client.close();
```

**See Also:** [Database Migrations](./database-migrations.md) for setup, workflow, and CI/CD integration.

---

## 5. llm-ui Package (React Frontend)

**Status:** ✅ Implemented (chat interface + workspace detail screen)

**Technology:** React 18 + TypeScript + Tailwind CSS + shadcn/ui + TanStack Router

**Files:**

```
llm-ui/src/
├── screens/
│   ├── workspace-detail-screen.tsx    # Workspace management 4-tab interface
│   ├── templates-screen.tsx           # Org prompt-template library management (admin CRUD)
│   ├── workspaces-screen.tsx          # Workspace list with search/filter
│   ├── chat-screen.tsx                # Chat interface with streaming
│   └── ...
│
├── components/
│   ├── workspace/                     # Workspace detail feature components
│   │   ├── members-tab.tsx            # Members list with add/remove
│   │   ├── add-member-dialog.tsx      # Dialog to add new member
│   │   ├── role-edit-popover.tsx      # Popover to edit member roles
│   │   ├── ws-member-row.tsx          # Single member list item
│   │   ├── ws-role-checklist.tsx      # Role selection checklist
│   │   ├── templates-tab.tsx          # Templates list with attach/detach
│   │   ├── add-templates-dialog.tsx   # Dialog to attach templates
│   │   ├── ws-template-card.tsx       # Template card with attach button
│   │   ├── providers-tab.tsx          # Provider list with enable/disable
│   │   ├── toggle-switch.tsx          # Reusable toggle component
│   │   └── ws-provider-row.tsx        # Provider list item
│   │
│   ├── templates/                     # Org prompt-template management components
│   │   ├── template-card.tsx          # Single template card (library view, admin edit)
│   │   ├── template-dialog.tsx        # Create/edit dialog with live preview + 12-icon picker + mono body textarea
│   │   └── template-delete-dialog.tsx # Delete confirm with 409 inline error display
│   │
│   ├── ui/                            # shadcn/ui base components
│   ├── widgets/                       # Shared widgets (role-badge, ws-emblem, etc.)
│   └── ...
│
├── lib/
│   ├── prompt-templates-api.ts        # Org template library CRUD API client (createTemplate, updateTemplate, deleteTemplate, listTemplateLibrary)
│   ├── workspace-members-api.ts       # Members API client
│   ├── workspace-templates-api.ts     # Workspace-template attachment API client
│   ├── workspace-providers-api.ts     # Providers API client
│   ├── api-member-adapter.ts          # Adapter: API response → UI model
│   ├── workspace-types.ts             # Shared TypeScript types
│   ├── workspaces-api.ts              # Workspace CRUD API client
│   ├── auth.ts                        # Auth management (token storage, login)
│   ├── api-error.ts                   # API error handling
│   ├── icons.ts                       # Icon registry (Lucide)
│   ├── cn.ts                          # Tailwind className utilities
│   ├── slugify.ts                     # URL slug generation + hue derivation
│   └── ...
│
├── App.tsx                            # Main app router
└── main.tsx                           # Entry point
```

**Key Features:**

- **Org Prompt-Template Library Management** (`templates-screen.tsx` + `components/templates/*`)
  - Admin CRUD: Create, edit, update, delete templates with live preview
  - Template fields: title (1–80), category (1–40), icon (1–40 + 12-icon picker UI), description (1–280), body (≤8000, nullable)
  - Delete confirm shows FK constraint violations inline (409 `template_in_use` when attached to workspaces)
  - Client-side paging: 9 templates per page, search by title/description
  - Components: `template-card.tsx` (library view), `template-dialog.tsx` (create/edit with live preview), `template-delete-dialog.tsx` (confirm + error display)

- **Workspace Detail Screen:** 4-tab interface (Members/Templates/Providers/Settings)
  - Members tab: List with add/edit/remove; role assignment (wsadmin, pm, ba, qa, dev)
  - Templates tab: Workspace-specific attachment interface (library → attach to workspace)
  - Providers tab: Enable/disable LLM providers per workspace
  - Settings tab: Workspace name/slug edit (admin-only)

- **API Integration:** Type-safe Fetch API clients with error handling
  - Org templates: Full CRUD (createTemplate, updateTemplate, deleteTemplate, listTemplateLibrary)
  - Members: List, add, update roles, remove
  - Workspace attachments: List attached, attach, detach templates
  - Providers: List, toggle enabled flag

- **UI Components:** Modular, reusable, keyboard-accessible
  - Dialogs, popovers, dropdowns (shadcn/ui base)
  - Role checklist, toggle switches, member/provider/template rows
  - Status badges with visual hue (derived from workspace slug)
  - Icon picker (12-icon registry in `lib/icons.ts`), mono body textarea for template content

- **State Management:** React hooks (useState, useCallback, useEffect)
  - Monotonic sequence guards for race condition handling
  - Error boundaries for graceful degradation
  - Real-time sync via sequential API calls (no polling)
