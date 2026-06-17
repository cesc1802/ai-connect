# LLM Gateway - Project Changelog

**Last Updated:** June 11, 2026

This document records significant changes, features, and fixes across the LLM Gateway project.

---

## [Unreleased] - 2026-06-17

### llm-http v0.0.7 (Feature Release)

**Outbound LLM Guardrails — Pre-Send Content Inspection & Transformation**

New pre-send guardrail pipeline for content inspection and transformation before outbound requests. Four check kinds: PII redaction, keyword/regex blocklist, prompt-injection detection, and LLM-based moderation.

**Architecture:**
- Pure function engine: `runGuardrails(request, policy, opts, registry) → { request, outcome, checks }` (stateless, reusable SDK unit)
- Workspace-scoped policies: `workspace_guardrail_policies` table (enabled flag, checks array)
- Enforcement at HTTP boundary: in `connection-session.ts` before `chat.requested` publish
- Block action: stops request, emits `stream.failed { code: "guardrail_blocked" }`, never publishes chat.requested (no message persistence, no provider)
- Redact action: swaps request with sanitized version, publishes to both persister (store-redacted invariant) and gateway
- Warn action: continues with original request, optional banner to client

**Check Kinds:**
1. **PII** (`pii`): Span-based redaction of email, API keys (openai, aws), bearer tokens, credit cards, IPv4, phone numbers; default action `redact`; mask format `[REDACTED:LABEL]`
2. **Blocklist** (`blocklist`): Keyword/regex matching with span extraction; actions redact/block/warn; configuration: terms, regexes, caseSensitive flag
3. **Injection** (`injection`): Prompt-injection classification (no span); block/warn only; via dedicated `InjectionClassifier`
4. **Moderation** (`moderation`): LLM-based content moderation via `ModerationClassifier` over static gateway instance; block/warn only

**API Endpoints:**
- `GET /workspaces/:id/guardrails` (member; 404 for non-member) — retrieve workspace policy
- `PUT /workspaces/:id/guardrails` (admin-only) — update policy (enabled flag, checks array)

**UI Components (llm-ui):**
- Workspace detail screen: Guardrails tab with master toggle + per-check enable/action controls + blocklist term editor
- Components: `guardrail-policy-form.tsx`, `guardrails-tab.tsx`
- API client: `guardrails-api.ts` (GET/PUT)

**Contract Changes:**
- `ChatRequested` event now carries required `workspaceId` for policy resolution

**Database:**
- New table: `workspace_guardrail_policies` (workspace_id FK, policy JSON)
- Migration: added to llm-db drizzle migrations

**SDK Opt-In (llm-gateway):**
- Per-request via `GatewayRequestOptions.guardrails` (optional; HTTP users always use workspace policy)

---

### llm-http v0.0.6 (Feature Release)

**Token Usage Capture per Provider & Workspace**

New event-driven token usage metrics capture pipeline with provider attribution and role-scoped dashboard API.

**Features:**
- `GET /api/dashboard/usage` — Role-scoped token usage endpoint (requireAuth; admin: org-wide; member: own workspaces only)
- Response: `{ byProvider: [{providerId, providerKind, inputTokens, outputTokens, totalTokens, requestCount}], byWorkspace: [{workspaceId, slug, name, inputTokens, outputTokens, totalTokens, requestCount}] }`
- Event-driven `usage-recorder.ts` consumer: captures {userId, conversationId, model} at `chat.requested` (pending-map keyed by requestId), joins on `stream.completed` to write single `usage_metrics` row
- Provider attribution: gateway-reported provider kind is authoritative; falls back to model-name prefix; records `providerKind="unknown"` with `providerId=null` rather than dropping tokens
- `providerId` resolved by `active-provider-resolver.ts` = newest ENABLED provider per kind (updatedAt desc, id asc)
- `usage_metrics.providerId` nullable FK with ON DELETE SET NULL (deleting provider does not block usage history; rows keep providerKind + model)
- Metrics writes wrapped in try/catch (failures never break chat stream); stream.failed/stream.aborted drop pending entry (no row persisted)

**Database:**
- Migration: `0007_usage_metrics_provider_nullable.sql` — makes provider_id nullable; sets FK to ON DELETE SET NULL

**UI Integration (llm-ui):**
- `lib/usage-api.ts getUsage()` — Fetch wrapper for dashboard usage endpoint
- `components/widgets/usage-summary.tsx` — Overview screen widget (Vietnamese: "Sử dụng token", "Theo provider", "Theo workspace"; K/M number formatting; empty + loading states)

---

## [Unreleased] - 2026-06-11

### llm-ui v0.0.5 (Feature Release)

**Chat Screen Workspace-First Redesign**

Complete rewrite of chat interface to prioritize workspace selection and team context, with persistent conversation history and template seeding.

**UI/UX Changes:**
- Removed: `chat-history-list`, `streaming-controls`, `template-picker` components; `default-model.ts` utility
- New rail-based layout: workspace-switcher → conversation list (date-grouped) → chat detail
- Workspace switcher: member's workspaces with role chips, conversation count per workspace
- Conversation rail: search + Hôm nay/Hôm qua/Trước đó grouping, client-side filtering
- New chat dialog: template seeded (optional templateId passed to server)
- Conversation header: template info card (icon, title, description) if applicable
- Composer: workspace-scoped template picker, stop button while streaming, canSend gate
- Message bubbles: tool card display, status notes on completion/abort
- Message list: auto-scroll, typing indicator with animated dots
- Vietnamese copy throughout (no model/agent pickers, workspace-centric)

**Backend Routes:**
- `GET /conversations` — owner-scoped paginated list (defaults: page=1, limit=20)
- `GET /conversations/:id/messages` — owner-scoped list ordered by createdAt
- `GET /api/me/workspaces` — user's workspace memberships + per-workspace roles
- `GET /api/me/default-model` — member-safe; returns first enabled provider's defaultModel

**Frontend API Integration:**
- `conversations-api.ts` — list, fetch messages
- `my-workspaces-api.ts` — fetch memberships with roles
- `my-default-model-api.ts` — fetch default model for user
- `group-conversations-by-day.ts` — utility to bucket conversations
- `workspace-hue.ts` — stable oklch hue from workspace id
- `workspace-display-name.ts` — short name derivation
- `workspace-roles.ts` — role permission matrix

**Chat v2 Protocol Updates:**
- `c.chat.send` now requires `workspaceId`, optional `templateId`; validates membership + template attachment
- Server returns `s.error invalid_template` if templateId not attached to target workspace
- Reducer: new `SERVER_ERROR` action dispatches transient error banner

**Database Schema:**
- `conversations.template_id` (nullable FK) — tracks template used for seeding
- Migration: `0006_conversation_template_id.sql`

**Testing:**
- 86 tests passing in llm-ui
- New tests for group-conversations-by-day, workspace-hue, workspace-display-name utilities

### llm-http v0.0.5 (Feature Release)

**Conversation Persistence + REST Routes + Message Pipeline**

New REST endpoints for fetching conversations and persistent message storage with event-driven pipeline.

**REST Endpoints:**
- `GET /conversations` — paginated owner-scoped list (query: page, limit; default limit=20)
- `GET /conversations/:id/messages` — owner-scoped message list ordered by createdAt (includes partial flag)

**Message Persistence Pipeline:**
- New `message-persister.ts` subscribes to event bus
- `chat.requested` event → persist user turn + auto-title untitled conversations (50-char truncation from first user message)
- `token.generated` event → buffer tokens (no persist)
- `stream.completed` event → persist assistant turn (full, partial=false)
- `stream.aborted` event → persist assistant turn (partial=true, incomplete content)
- Prompt assembly uses persisted DB history + newest client message only (dedup guard)
- Conversation.updatedAt touched on each turn persist (for rail sorting)

**Repository Enhancements:**
- `ConversationRepository.touch(id)` — update updatedAt timestamp
- `Conversation` type gained `templateId` (optional, tracks template seeding)

**Architecture:**
- Event-driven: persister is stateless subscriber, decoupled from websocket handler
- In-flight graceful shutdown: streams complete before persister closes

### llm-http v0.0.4 (Feature Release)

**Provider CRUD REST API (`/providers`)**

New org-admin-only REST endpoints for managing LLM provider instances with live connection validation:

**Endpoints:**
- `GET /providers` — List all org providers (includes disabled, redacts API keys)
- `GET /providers/catalog` — List provider catalog (kind registry with models, icons, baseUrl requirement)
- `POST /providers/check` — Test live connection (5s timeout, API key in header only, no persist)
- `POST /providers` — Create provider instance (201, validates kind/name, encrypts key)
- `PATCH /providers/:id` — Update name/baseUrl/enabled (admin-only, 409 on duplicate name)
- `POST /providers/:id/rotate-key` — Replace API key with new one
- `DELETE /providers/:id` — Delete provider (204, 409 if in-use by workspace/gateway)

**Architecture:**
- Connection checker probes endpoint with 5-second timeout
- API keys travel in headers only (never in URL, never logged)
- Separate probe strategy per kind (keyed endpoint for hosted; reachability-only for self-hosted)
- Reuses existing `OrgProvidersService` + `DrizzleProvidersRepository`
- Legacy `/admin/org/providers` routes remain unchanged
- Org-admin role enforcement via `createRequireOrgAdmin` middleware

**Database Impact:**
- New `provider_catalogs` table seeded with 7 kinds (anthropic, openai, ollama, minimax, google, azure-openai, custom)
- `providers.default_model` nullable text column (for org/workspace-scoped model defaults, future use)
- `providers.scope` enum (default 'org') for org vs workspace-scoped overrides

**Frontend Integration (llm-ui):**
- `src/lib/providers-api.ts` — Type-safe Fetch client (list, check, create, update, rotate, delete)
- `src/lib/provider-mapping.ts` — Kind-to-icon, kind-to-label mappings (derived from catalog)
- Providers screen removed mock store; now uses real API with server-state fetch-on-mount
- Loading/error/empty states; 'disabled' status badge for isEnabled=false

**Error Codes:**
- 400 `invalid_body` — validation failed (name length, kind unknown, key constraints)
- 401 — missing/invalid auth token
- 403 `insufficient_role` — non-org-admin user
- 404 `provider_not_found` — provider not in org
- 409 `duplicate_name` — provider name already exists in org
- 409 `provider_in_use` — cannot delete; provider has active workspaces or is in-flight

### llm-gateway v1.1.0 (Feature Release)

**Lazy-Load Provider Configuration with DB Source**

Providers now load from the database on first request (lazy-load) instead of at boot time from environment variables. Enables zero-downtime provider updates without restart.

- New `ProviderConfigSource` interface: pluggable config source with TTL refresh-on-use (default 60s, min 1s)
- Config diffing: unchanged providers retain circuit-breaker state across refresh
- Graceful swap: in-flight streams complete before provider disposal
- Gateway now accepts `source` and `refreshTtlMs` in config (XOR with static `providers`)
- First load failure → CONFIG_SOURCE_ERROR; later failures → keep last good config
- `onSourceError` callback for custom error handling (e.g. logging)
- Static config mode (SDK usage) unchanged for backward compatibility

### llm-http v0.0.3 (Feature Release + **BREAKING CHANGES**)

**Lazy-Load DB Provider Configuration**

Providers are now seeded in the database via admin API; environment variables no longer used for gateway construction.

**BREAKING DEPLOY CHANGE — Providers must be database-seeded before/after upgrade:**
- ❌ Removed: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OLLAMA_BASE_URL`, `MINIMAX_API_KEY` env vars (no longer read by llm-http)
- ✅ Required: `PROVIDER_KEY_VAULT_KEY` (32-byte hex) for AES-256-GCM decryption of provider secrets in DB
- ✅ Required: `DATABASE_URL` for provider persistence
- ✅ Optional: `PROVIDER_REFRESH_TTL_MS` (default 60000ms, floored at 1000ms for gateway)

**Migration Path:**
1. Seed providers to DB via org admin API before upgrading server
2. Upgrade container with new code
3. Server boots with DB source; chat routes to database-configured providers
4. Delete any env vars from deployment config

**New Features:**
- `DbProviderConfigSource` in `llm-http/src/providers/db-provider-config-source.ts`
- Single database query over `providers` ⋈ `provider_catalogs` (enabled rows)
- Key decryption via existing `ApiKeyVault` (AES-256-GCM)
- Smart skip+warn rules: unsupported kinds (google, azure-openai, custom); duplicates by kind → newest `updatedAt` wins; ollama without baseUrl; missing/corrupt/empty keys
- Never logs key material
- Container always builds with DB source; eager warm-up logs warning if zero providers exist at boot

**Ops-Visible Changes:**
- `GET /health` shows empty provider list until first chat request triggers lazy load
- After provider changes via API, chat routes to new config within TTL (no restart needed)
- DB outage after first successful load: gateway serves last known config

---

## [Unreleased] - 2026-06-10

### llm-http v0.0.2 (Feature Release)

**Workspace Management — Paging & CRUD**

New endpoints for paginated workspace listing and full CRUD operations:
- `GET /workspaces` — paginated list (page, limit; default 20, max 100), role-aware (admin: all; member: own only)
- `POST /workspaces` — create workspace (admin-only, auto-slug from name)
- `GET /workspaces/:id` — fetch single (admin: any; member: own only or 404)
- `PATCH /workspaces/:id` — update name/slug (admin-only, ≥1 field required)
- `DELETE /workspaces/:id` — soft-delete (admin-only, 204 on success)
- `GET /api/me/active-workspace` — resolve user's active workspace

**Architecture:**
- Repository pattern + Postgres (Drizzle ORM) implementation
- Workspace repository interface: `getById()`, `isMember()`, `listAll()`, `listForUser()`, `create()`, `update()`, `softDelete()`
- Role-based access control: member reads return 404 on non-membership (prevents existence leak)
- Slug validation: `^[a-z0-9]+(-[a-z0-9]+)*$` (max 50 chars); auto-derived from name if omitted
- Error codes: `workspace_not_found` (404), `invalid_body` (400), `slug_taken` (409)

**Testing:**
- Comprehensive test coverage for all endpoints
- Role-based access control verification
- Slug validation and uniqueness tests
- Paging boundary and parameter tests

### llm-ui

**Workspace Management UI**

New screens, components, and utilities for workspace management:
- Workspace list screen with server-side pagination (GET /workspaces?page&limit=6)
- Create dialog with auto-slug derivation from Vietnamese names
- Workspace detail screen with tabbed layout (overview, settings, members, templates, providers)
- Settings tab: edit name/slug (PATCH) and delete workspace (DELETE with confirm)
- Slugify utility for Vietnamese-aware slug generation (src/lib/slugify.ts)
- Workspaces API client (src/lib/workspaces-api.ts)
- Pagination component with page navigation (src/components/ui/pagination.tsx)

**Files added:**
- `src/screens/workspaces-list-screen.tsx`
- `src/screens/workspace-detail-screen.tsx`
- `src/lib/workspaces-api.ts`
- `src/lib/slugify.ts`
- `src/components/ui/pagination.tsx`
- `src/components/widgets/workspace-create-dialog.tsx`
- `src/components/widgets/workspace-settings-tab.tsx`

---

## [1.0.0] - 2026-04-17

### llm-http v0.0.1 (Initial Release)

HTTP/WebSocket server providing REST API and real-time streaming interface to the LLM Gateway.

**Features:**
- JWT authentication with bcrypt password hashing
- POST /auth/login endpoint with rate limiting (5 attempts/15 min)
- POST /chat REST endpoint for synchronous chat requests
- WebSocket streaming endpoint with JWT auth on upgrade
- Rate limiting per user for chat (60 requests/hour)
- Command pattern for WebSocket message handling (chat, ping)
- Backpressure handling with 1MB buffer threshold
- Message size validation (1MB limit)
- Error mapping with sanitized messages for security
- Health check endpoint at GET /health

**Architecture:**
- Manual dependency injection container (no framework)
- Ports and adapters pattern for gateway abstraction
- Interface-based fakes for testing (no vi.mock)
- Command pattern for extensible message handlers
- Zod schemas for request validation

**Testing:**
- 343 tests passing
- 92.68% overall test coverage
- auth/: 90.47% coverage
- chat/: 80.62% coverage
- Integration tests for full auth flow

**Limitations:**
- In-memory user storage (DEMO_USERS env var)
- Single instance rate limiting (not distributed)
- Token in query parameter for WebSocket auth
- No refresh token mechanism

### llm-shared v0.0.1 (Initial Release)

Shared types package for WebSocket protocol and auth.

**Exports:**
- `ClientMessage`: Union type for chat/ping messages
- `ServerMessage`: Union type for chunk/done/error/pong messages
- `User`, `JWTPayload`: Auth types
- Re-exports: `ChatMessage`, `TokenUsage`, `FinishReason` from llm-gateway

### llm-gateway v1.0.0 (Stable)

Core LLM provider abstraction with resilience patterns.

**Providers:**
- Anthropic Claude (SDK-based)
- OpenAI GPT (SDK-based)
- Ollama (fetch-based, local models)
- MiniMax (fetch-based)

**Resilience:**
- Circuit breaker (CLOSED/OPEN/HALF_OPEN states)
- Retry decorator with exponential backoff
- Fallback chains for provider redundancy

**Routing:**
- Round-robin strategy
- Cost-based strategy
- Capability-based strategy

**Observability:**
- OpenTelemetry integration
- Request/error/latency metrics
- Per-provider health tracking

---

## Version History Summary

| Date | Package | Version | Type | Summary |
|------|---------|---------|------|---------|
| 2026-06-11 | llm-ui | 0.0.5 | Feature | Chat screen workspace-first redesign + persistent history |
| 2026-06-11 | llm-http | 0.0.5 | Feature | Conversation REST routes + event-driven message persistence |
| 2026-06-11 | llm-http | 0.0.4 | Feature | Provider CRUD REST API + connection checker (5s timeout) |
| 2026-06-11 | llm-gateway | 1.1.0 | Feature | ProviderConfigSource + TTL refresh + graceful swap |
| 2026-06-11 | llm-http | 0.0.3 | Feature | **BREAKING** Lazy-load DB providers (env vars removed) |
| 2026-06-10 | llm-http | 0.0.2 | Feature | Workspace paging & CRUD (GET/POST/PATCH/DELETE) |
| 2026-06-10 | llm-ui | 0.0.4 | Feature | Workspace management screens & components |
| 2026-04-17 | llm-http | 0.0.1 | Feature | Initial HTTP/WS server release |
| 2026-04-17 | llm-shared | 0.0.1 | Feature | Initial shared types release |
| 2026-04-17 | llm-gateway | 1.0.0 | Stable | Production-ready gateway |

---

## Migration Notes

### From v0.0.2 to v0.0.3 (llm-http) — Database-Sourced Providers

**Before Upgrade:**
1. Export existing providers from environment into a migration script (map ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)
2. Seed providers to DB using admin API: `POST /organizations/:orgId/providers` with provider details

**During Upgrade:**
1. Set `NODE_ENV=production` to enable trust proxy
2. Use strong `JWT_SECRET` (min 32 chars)
3. Set `DATABASE_URL` and `PROVIDER_KEY_VAULT_KEY` (32-byte hex for AES-256-GCM)
4. **Remove** any `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OLLAMA_BASE_URL`, `MINIMAX_API_KEY` from environment
5. Optional: `PROVIDER_REFRESH_TTL_MS` (default 60000ms)
6. Set up reverse proxy (nginx/cloudflare) for TLS

**After Upgrade:**
1. First boot logs warning if zero providers in DB (non-fatal)
2. Create/enable providers via admin API
3. Chat routes to DB-configured providers within TTL (no restart needed)
4. Health endpoint shows provider list after first chat request (lazy load)

### From Development to Production

1. Set `NODE_ENV=production` to enable trust proxy
2. Use strong `JWT_SECRET` (min 32 chars)
3. Use secure `PROVIDER_KEY_VAULT_KEY` (generate 32-byte random hex)
4. Set up reverse proxy (nginx/cloudflare) for TLS
5. Consider Redis for distributed rate limiting (future)

### Future Breaking Changes

- `llm-db` package will provide `UserRepository` implementation
- WebSocket auth may move from query param to first message
- Refresh token mechanism planned for v2.0
