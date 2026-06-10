# LLM Gateway - Project Changelog

**Last Updated:** June 10, 2026

This document records significant changes, features, and fixes across the LLM Gateway project.

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
| 2026-06-10 | llm-http | 0.0.2 | Feature | Workspace paging & CRUD (GET/POST/PATCH/DELETE) |
| 2026-06-10 | llm-ui | — | Feature | Workspace management screens & components |
| 2026-04-17 | llm-http | 0.0.1 | Feature | Initial HTTP/WS server release |
| 2026-04-17 | llm-shared | 0.0.1 | Feature | Initial shared types release |
| 2026-04-17 | llm-gateway | 1.0.0 | Stable | Production-ready gateway |

---

## Migration Notes

### From Development to Production (llm-http)

1. Set `NODE_ENV=production` to enable trust proxy
2. Use strong `JWT_SECRET` (min 32 chars)
3. Configure LLM provider API keys
4. Set up reverse proxy (nginx/cloudflare) for TLS
5. Consider Redis for distributed rate limiting (future)

### Future Breaking Changes

- `llm-db` package will provide `UserRepository` implementation
- WebSocket auth may move from query param to first message
- Refresh token mechanism planned for v1.1
