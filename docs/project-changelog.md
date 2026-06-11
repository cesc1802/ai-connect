# LLM Gateway - Project Changelog

**Last Updated:** June 11, 2026

This document records significant changes, features, and fixes across the LLM Gateway project.

---

## [Unreleased] - 2026-06-11

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
| 2026-06-11 | llm-gateway | 1.1.0 | Feature | ProviderConfigSource + TTL refresh + graceful swap |
| 2026-06-11 | llm-http | 0.0.3 | Feature | **BREAKING** Lazy-load DB providers (env vars removed) |
| 2026-06-10 | llm-http | 0.0.2 | Feature | Workspace paging & CRUD (GET/POST/PATCH/DELETE) |
| 2026-06-10 | llm-ui | — | Feature | Workspace management screens & components |
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
