# API Documentation — `@ai-connect/http`

HTTP/WebSocket server exposing a REST control plane (auth, org/workspace admin) and a real-time streaming chat interface backed by the LLM Gateway.

- **Base URL (dev):** `http://localhost:3000`
- **Content type:** `application/json` for all REST request/response bodies
- **Request body limit:** `1mb` (Express `json` parser)
- **Source of truth:** route handlers under `src/`; this doc is generated from them

> The legacy WebSocket section in `README.md` is outdated. The protocol below (message types `c.chat.*` / `s.chat.*`) reflects the current code in `src/chat-v2/`.

### curl setup

All curl examples below assume these shell variables:

```bash
export BASE="http://localhost:3000"
# Obtain a token from POST /auth/login, then:
export TOKEN="<paste-jwt-here>"
```

Protected routes send `-H "Authorization: Bearer $TOKEN"`. Path params like `:id` are shown as literals — substitute a real id.

---

## Authentication

### Token model

- **Scheme:** JWT, `HS256`, signed with `JWT_SECRET`.
- **Obtain:** `POST /auth/login` (see below).
- **Send:** `Authorization: Bearer <token>` header on protected REST routes.
- **Claims (slim):** `{ sub: <userId>, username, iat, exp }`. Signed in `src/auth/jwt-service.ts`.

### Identity resolution (`requireAuth`)

On each protected request, the middleware (`src/auth/auth-middleware.ts`):

1. Verifies the `Bearer` token.
2. Loads the user record by `username` from the user repository.
3. Attaches `req.user`:

```jsonc
{
  "id": "<userId>",
  "username": "<username>",
  "role": "admin | member",     // system role from the user record
  "org": "default",              // transitional shim (hardcoded)
  "orgRole": "admin | member",   // mirrors system role
  "workspace": null,             // transitional shim
  "workspaceRole": "admin | null" // "admin" iff system role is admin, else null
}
```

> `org`, `workspace`, and the role shims are transitional while the admin routes are migrated to the slim JWT. Effectively, **all `/admin/**` routes today require a system `admin` user.**

### Authorization guards

| Guard | Requirement | Failure |
|-------|-------------|---------|
| `requireAuth` | Valid Bearer token + existing user | `401 missing_token` / `401 invalid_token` |
| `requireOrgAdmin` | `orgRole === "admin"` | `403 role_required` |
| `requireWorkspaceAdmin` | `workspaceRole` ∈ {`owner`,`admin`} | `403 role_required` |

---

## Error format

Errors are JSON with a stable machine-readable `code` and a human `message`:

```json
{ "code": "invalid_body", "message": "Username is required" }
```

Validation errors from admin routes may additionally include a Zod `issues` array. Some member-route conflicts also include an `error` field (e.g. `unprocessable_entity`).

Common cross-cutting codes:

| Status | Code | Meaning |
|--------|------|---------|
| 400 | `invalid_body` / `invalid_input` | Request body failed schema validation |
| 401 | `missing_token` | No `Authorization: Bearer` header |
| 401 | `invalid_token` | Token invalid/expired or user not found |
| 401 | `unauthenticated` | Authenticated context missing on a provider/ws route |
| 403 | `role_required` | Authenticated but lacks required role |
| 409 | (route-specific) | Uniqueness / concurrency conflict |

---

## REST Endpoints

### Health

#### `GET /health`

Liveness + gateway metrics. **No auth.**

```bash
curl "$BASE/health"
```

**200**
```json
{
  "status": "ok",
  "uptime": 123.45,
  "providers": [ /* per-provider metrics from the gateway */ ]
}
```

---

### Auth

#### `POST /auth/login`

Exchange credentials for a JWT. **No auth.** Rate limited per IP (`RATE_LIMIT_LOGIN_*`, default 5 / 15 min).

```bash
curl -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"admin123456"}'
```

**Request**
```json
{ "username": "demo", "password": "admin123456" }
```

**200**
```json
{ "token": "eyJhbGciOiJIUzI1NiI...", "expiresIn": "24h" }
```

| Status | Code | When |
|--------|------|------|
| 400 | `invalid_body` | `username` or `password` missing/empty |
| 401 | `invalid_credentials` | Bad username/password |
| 429 | `rate_limited` | Too many login attempts |

#### `POST /auth/register`

Create a new user account. **No auth.** New users get the `member` role. Rate limited per IP — shares the login limiter (`RATE_LIMIT_LOGIN_*`, default 5 / 15 min). Does **not** return a token; call `POST /auth/login` afterwards.

```bash
curl -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"hunter2pass"}'
```
---
{"username":"pm@admin.local","password":"pm!@1802"}

---

**Request**
```json
{ "username": "alice", "password": "hunter2pass" }
```
- `username`: ≥ 3 chars
- `password`: ≥ 8 chars

**201**
```json
{ "id": "<userId>", "username": "alice" }
```

| Status | Code | When |
|--------|------|------|
| 400 | `invalid_body` | `username` < 3 or `password` < 8 chars |
| 409 | `username_taken` | Username already exists |
| 429 | `rate_limited` | Too many attempts |

---

### Active Workspace

#### `GET /api/me/active-workspace`

Resolve the caller's active workspace. **Auth required.**

```bash
curl "$BASE/api/me/active-workspace" \
  -H "Authorization: Bearer $TOKEN"
```

**200**
```json
{ "workspace": { /* workspace object */ } }
```

| Status | Code | When |
|--------|------|------|
| 401 | `missing_token` | No authenticated user |
| 404 | `no_active_workspace` | User has no active workspace |

---

### Prompt Templates (Org Library)

Org-wide prompt-template library. **Read: any authenticated user. Write (POST/PATCH/DELETE): system `admin` only.**

**Validation**
- `title`: 1–80 chars (trimmed)
- `category`: 1–40 chars (trimmed)
- `icon`: 1–40 chars (trimmed)
- `description`: 1–280 chars (trimmed)
- `body`: ≤8000 chars, optional; blank string normalized to `null`

#### `GET /prompt-templates`

List org template library. **Auth required.**

```bash
curl "$BASE/prompt-templates" \
  -H "Authorization: Bearer $TOKEN"
```

**200**
```json
{
  "templates": [
    {
      "id": "<uuid>",
      "slug": "tpl-<uuid>",
      "title": "Code Review",
      "category": "engineering",
      "icon": "code",
      "authorName": "demo",
      "uses": 0,
      "description": "Review and comment on code",
      "body": "You are a code reviewer..."
    }
  ]
}
```

| Status | Code | When |
|--------|------|------|
| 401 | `missing_token` | Missing Bearer token |

#### `POST /prompt-templates`

Create a template. **Auth required + system `admin` role.** Slug is auto-generated as `tpl-<uuid>`; author resolved from JWT.

**Request**
```json
{
  "title": "Code Review",
  "category": "engineering",
  "icon": "code",
  "description": "Review and comment on code",
  "body": "You are a code reviewer..."
}
```

```bash
curl -X POST "$BASE/prompt-templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Code Review","category":"engineering","icon":"code","description":"...","body":"..."}'
```

**201**
```json
{
  "template": {
    "id": "<uuid>",
    "slug": "tpl-<uuid>",
    "title": "Code Review",
    "category": "engineering",
    "icon": "code",
    "authorName": "demo",
    "uses": 0,
    "description": "Review and comment on code",
    "body": "You are a code reviewer..."
  }
}
```

| Status | Code | When |
|--------|------|------|
| 400 | `invalid_input` | Schema validation failed (+ Zod `issues`) |
| 401 | `missing_token` / `invalid_token` | Missing or invalid Bearer token |
| 403 | `role_required` | Caller is not a system admin |

#### `PATCH /prompt-templates/:id`

Update a template (partial; at least one field required). **Auth required + system `admin` role.**

**Request** (at least one field)
```json
{
  "title": "Code Review v2",
  "description": "Updated description..."
}
```

```bash
curl -X PATCH "$BASE/prompt-templates/<id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Code Review v2"}'
```

**200**
```json
{
  "template": { /* full template object */ }
}
```

| Status | Code | When |
|--------|------|------|
| 400 | `invalid_input` | Schema validation failed or no fields provided |
| 401 | `missing_token` / `invalid_token` | Missing or invalid Bearer token |
| 403 | `role_required` | Caller is not a system admin |
| 404 | `not_found` | Template does not exist |

#### `DELETE /prompt-templates/:id`

Delete a template. **Auth required + system `admin` role.** Fails with 409 if template is attached to any workspace (foreign key restrict).

```bash
curl -X DELETE "$BASE/prompt-templates/<id>" \
  -H "Authorization: Bearer $TOKEN"
```

**204**  
No response body.

| Status | Code | When |
|--------|------|------|
| 401 | `missing_token` / `invalid_token` | Missing or invalid Bearer token |
| 403 | `role_required` | Caller is not a system admin |
| 404 | `not_found` | Template does not exist |
| 409 | `template_in_use` | Template is attached to one or more workspaces (FK restrict) |

---

### Workspaces

#### `GET /workspaces`

List workspaces, paginated. **Auth required.** Role-aware:

- System `admin` → all non-deleted workspaces.
- System `member` → only workspaces the user belongs to (via `user_workspaces`).

Query params: `page` (default `1`, min `1`), `limit` (default `20`, min `1`, max `100`).

```bash
curl "$BASE/workspaces?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

**200**
```json
{
  "items": [
    { "id": "<uuid>", "slug": "team-rocket", "name": "Team Rocket", "createdAt": "2026-06-10T03:00:00.000Z" }
  ],
  "page": 1,
  "limit": 20,
  "total": 1
}
```

| Status | Code | When |
|--------|------|------|
| 400 | `invalid_body` | `page`/`limit` fail validation |
| 401 | `missing_token` / `invalid_token` | Missing or invalid Bearer token |

#### `POST /workspaces`

Create a workspace. **Auth required + system `admin` role.**

Body: `name` (required, 1–100 chars after trim); `slug` (optional, `^[a-z0-9]+(-[a-z0-9]+)*$`, max 50). When `slug` is omitted it is derived from `name` (lowercase, non-alphanumerics → hyphens, truncated to 50 chars). The creator is **not** auto-added as a member.

```bash
curl -X POST "$BASE/workspaces" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Team Rocket"}'
```

**201**
```json
{ "id": "<uuid>", "slug": "team-rocket", "name": "Team Rocket", "createdAt": "2026-06-10T03:00:00.000Z" }
```

| Status | Code | When |
|--------|------|------|
| 400 | `invalid_body` | Body fails validation, or derived slug is empty |
| 401 | `missing_token` / `invalid_token` | Missing or invalid Bearer token |
| 403 | `role_required` | Caller is not a system admin |
| 409 | `slug_taken` | Workspace slug already exists |

#### `GET /workspaces/:id`

Fetch a single workspace. **Auth required.** Role-aware:
- System `admin` → can view any non-deleted workspace.
- System `member` → can only view workspaces they belong to (returns 404 for non-membership to prevent existence leak).

```bash
curl "$BASE/workspaces/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
```

**200**
```json
{ "id": "<uuid>", "slug": "team-rocket", "name": "Team Rocket", "createdAt": "2026-06-10T03:00:00.000Z" }
```

| Status | Code | When |
|--------|------|------|
| 401 | `missing_token` / `invalid_token` | Missing or invalid Bearer token |
| 404 | `workspace_not_found` | Workspace does not exist, or caller is member and not in workspace |

#### `PATCH /workspaces/:id`

Update a workspace. **Auth required + system `admin` role.** Body: `name` (optional, 1–100 chars); `slug` (optional, `^[a-z0-9]+(-[a-z0-9]+)*$`, max 50). At least one field is required.

```bash
curl -X PATCH "$BASE/workspaces/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Team Rocket v2"}'
```

**200**
```json
{ "id": "<uuid>", "slug": "team-rocket", "name": "Team Rocket v2", "createdAt": "2026-06-10T03:00:00.000Z" }
```

| Status | Code | When |
|--------|------|------|
| 400 | `invalid_body` | Body fails validation or no fields provided |
| 401 | `missing_token` / `invalid_token` | Missing or invalid Bearer token |
| 403 | `role_required` | Caller is not a system admin |
| 404 | `workspace_not_found` | Workspace does not exist |
| 409 | `slug_taken` | New slug already exists (when provided) |

#### `DELETE /workspaces/:id`

Soft-delete a workspace. **Auth required + system `admin` role.** Deletion is not reversible via API; only admins can delete. Attempting to delete an already-deleted workspace returns 404.

```bash
curl -X DELETE "$BASE/workspaces/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
```

**204**  
No response body.

| Status | Code | When |
|--------|------|------|
| 401 | `missing_token` / `invalid_token` | Missing or invalid Bearer token |
| 403 | `role_required` | Caller is not a system admin |
| 404 | `workspace_not_found` | Workspace does not exist or already deleted |

---

### Org Admin — Users

Base path `/admin/org/users`. **Auth + org admin.** `orgId` is taken from the token (`req.user.org`).

#### `GET /admin/org/users`
List org users → **200** `{ "users": [...] }`

```bash
curl "$BASE/admin/org/users" \
  -H "Authorization: Bearer $TOKEN"
```

#### `POST /admin/org/users/invite`
Invite a user by email.

**Request** `{ "email": "person@example.com" }`

```bash
curl -X POST "$BASE/admin/org/users/invite" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"person@example.com"}'
```

| Status | Body | When |
|--------|------|------|
| 201 | invite row | Created |
| 400 | `invalid_body` | Invalid email |
| 409 | `duplicate_pending` | Pending invite already exists for email |

#### `POST /admin/org/users/:id/disable`
Disable a user.

```bash
curl -X POST "$BASE/admin/org/users/:id/disable" \
  -H "Authorization: Bearer $TOKEN"
```

| Status | Body | When |
|--------|------|------|
| 200 | updated row | Disabled |
| 404 | `user_not_found` | No such user |

---

### Org Admin — Templates

Base path `/admin/org/templates`. **Auth + org admin.**

**Validation**
- `name`: 2–80 chars
- `description`: ≤ 280 chars (optional)
- `body`: 1–8000 chars
- `tags`: ≤ 6 items, each matching `^[a-z][a-z0-9-]{0,23}$` (lowercase only)

#### `GET /admin/org/templates`
→ **200** `{ "templates": [...] }`

```bash
curl "$BASE/admin/org/templates" \
  -H "Authorization: Bearer $TOKEN"
```

#### `POST /admin/org/templates`
Create. **Request**
```json
{ "name": "Bug triage", "description": "...", "body": "...", "tags": ["support"] }
```

```bash
curl -X POST "$BASE/admin/org/templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bug triage","description":"Triage incoming bugs","body":"You are a triage assistant...","tags":["support"]}'
```
| Status | Body | When |
|--------|------|------|
| 201 | template row | Created |
| 400 | `invalid_input` (+ `issues`) | Schema failure |
| 409 | `template_name_conflict` | Name already used |

#### `PATCH /admin/org/templates/:id`
Update (partial; at least one field required).

```bash
curl -X PATCH "$BASE/admin/org/templates/:id" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bug triage v2"}'
```

| Status | Body | When |
|--------|------|------|
| 200 | template row | Updated |
| 400 | `invalid_input` | Schema failure / empty body |
| 404 | `not_found` | No such template |
| 409 | `template_name_conflict` | Name already used |

#### `DELETE /admin/org/templates/:id`

```bash
curl -X DELETE "$BASE/admin/org/templates/:id" \
  -H "Authorization: Bearer $TOKEN"
```

| Status | When |
|--------|------|
| 204 | Deleted (no body) |
| 404 | `not_found` |

---

### Org Admin — Providers

Base path `/admin/org/providers`. **Auth + org admin.** API keys are write-only (stored in the vault, never returned).

**Validation**
- `displayName`: 1–80 chars (trimmed)
- `providerKind`: one of the supported `PROVIDER_KINDS` enum
- `apiKey`: ≥ 8 chars

#### `GET /admin/org/providers`
→ **200** `{ "providers": [...] }`

```bash
curl "$BASE/admin/org/providers" \
  -H "Authorization: Bearer $TOKEN"
```

#### `POST /admin/org/providers`
Add a provider with a key. **Request**
```json
{ "displayName": "Prod Anthropic", "providerKind": "anthropic", "apiKey": "sk-..." }
```

```bash
curl -X POST "$BASE/admin/org/providers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Prod Anthropic","providerKind":"anthropic","apiKey":"sk-ant-..."}'
```
| Status | Body | When |
|--------|------|------|
| 201 | `{ "provider": {...} }` | Created |
| 400 | `invalid_body` | Schema failure |
| 409 | duplicate-name code | Display name already used |

#### `PATCH /admin/org/providers/:id`
Update `displayName` and/or `isEnabled` (at least one).

```bash
curl -X PATCH "$BASE/admin/org/providers/:id" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isEnabled":false}'
```

| Status | Body | When |
|--------|------|------|
| 200 | `{ "provider": {...} }` | Updated |
| 400 | `invalid_body` | No updatable fields / schema failure |
| 404 | not-found code | No such provider |
| 409 | duplicate-name code | Display name conflict |

#### `POST /admin/org/providers/:id/rotate-key`
Replace the stored API key. **Request** `{ "apiKey": "sk-new..." }`

```bash
curl -X POST "$BASE/admin/org/providers/:id/rotate-key" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"sk-ant-new..."}'
```

| Status | Body | When |
|--------|------|------|
| 200 | `{ "provider": {...} }` | Rotated |
| 400 | `invalid_body` | `apiKey` too short |
| 404 | not-found code | No such provider |

#### `DELETE /admin/org/providers/:id`

```bash
curl -X DELETE "$BASE/admin/org/providers/:id" \
  -H "Authorization: Bearer $TOKEN"
```

| Status | When |
|--------|------|
| 204 | Deleted (no body) |
| 404 | not-found code |

---

### Workspace Admin — Members

Base path `/admin/workspace/members`. **Auth + workspace admin.** Requires an active workspace on the token (`req.user.workspace`); otherwise `403 no_workspace`.

**Roles:** `owner` | `admin` | `member` | `viewer`.

#### `GET /admin/workspace/members`
→ **200** `{ "members": [...] }`

```bash
curl "$BASE/admin/workspace/members" \
  -H "Authorization: Bearer $TOKEN"
```

#### `POST /admin/workspace/members/invite`
**Request** `{ "email": "person@example.com", "role": "member" }`

```bash
curl -X POST "$BASE/admin/workspace/members/invite" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"person@example.com","role":"member"}'
```

| Status | Body | When |
|--------|------|------|
| 201 | member row | Invited |
| 400 | `invalid_body` | Schema failure |
| 403 | `no_workspace` | No active workspace |
| 409 | `duplicate_member` | Email already a member |

#### `PATCH /admin/workspace/members/:id`
Change role. **Request** `{ "role": "admin" }`

```bash
curl -X PATCH "$BASE/admin/workspace/members/:id" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}'
```

| Status | Body | When |
|--------|------|------|
| 200 | member row | Updated |
| 404 | `member_not_found` | No such member |
| 422 | `last_admin` (+ `error: unprocessable_entity`) | Would remove the last admin |

#### `DELETE /admin/workspace/members/:id`
Remove a member.

```bash
curl -X DELETE "$BASE/admin/workspace/members/:id" \
  -H "Authorization: Bearer $TOKEN"
```

| Status | Body | When |
|--------|------|------|
| 200 | removed row | Removed |
| 404 | `member_not_found` | No such member |
| 422 | `last_admin` | Would remove the last admin |

---

### Workspace Admin — Roles

#### `GET /admin/workspace/roles`
Static role catalogue. **Auth + workspace admin.**

```bash
curl "$BASE/admin/workspace/roles" \
  -H "Authorization: Bearer $TOKEN"
```

**200**
```json
{
  "roles": [
    { "role": "owner",  "description": "Full workspace control including deletion" },
    { "role": "admin",  "description": "Manage members, providers, templates, and quotas" },
    { "role": "member", "description": "Send chats and view templates" },
    { "role": "viewer", "description": "Read-only access to conversations" }
  ]
}
```

---

### Workspace Admin — Providers (binding)

Base path `/admin/workspace/providers`. **Auth + workspace admin.** Binds a subset of org providers to the workspace. Uses **ETag / optimistic concurrency**.

#### `GET /admin/workspace/providers`
→ **200** + `ETag` header
```json
{ "available": [...], "bound": [...] }
```

```bash
# -i to surface the ETag response header
curl -i "$BASE/admin/workspace/providers" \
  -H "Authorization: Bearer $TOKEN"
```

#### `PUT /admin/workspace/providers`
Replace the bound set. Send `If-Match: "<etag>"` for concurrency control (optional; quotes stripped).

**Request** `{ "providerIds": ["p1", "p2"] }` (≤ 100 ids)

```bash
curl -X PUT "$BASE/admin/workspace/providers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "<etag-from-GET>"' \
  -d '{"providerIds":["p1","p2"]}'
```

| Status | Body | When |
|--------|------|------|
| 200 | `{ available, bound }` + `ETag` | Replaced |
| 400 | `invalid_body` | Schema failure |
| 400 | not-in-pool code (+ `invalidIds`) | Provider id not in org pool |
| 409 | etag-mismatch code | `If-Match` did not match current ETag |

---

### Workspace Admin — Templates (binding)

Base path `/admin/workspace/templates`. **Auth + workspace admin.** Same ETag pattern as providers.

#### `GET /admin/workspace/templates`
→ **200** + `ETag` → `{ "available": [...], "bound": [...] }`

```bash
curl -i "$BASE/admin/workspace/templates" \
  -H "Authorization: Bearer $TOKEN"
```

#### `PUT /admin/workspace/templates`
**Request**
```json
{ "templates": [ { "templateId": "t1", "suggestedRole": "member" } ] }
```
(≤ 100 items; `suggestedRole` ∈ owner/admin/member/viewer)

```bash
curl -X PUT "$BASE/admin/workspace/templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "<etag-from-GET>"' \
  -d '{"templates":[{"templateId":"t1","suggestedRole":"member"}]}'
```

| Status | Body | When |
|--------|------|------|
| 200 | `{ available, bound }` + `ETag` | Replaced |
| 400 | `invalid_body` | Schema failure |
| 400 | not-in-pool code (+ `invalidIds`) | Template id not in org pool |
| 409 | etag-mismatch code | `If-Match` mismatch |

---

### Workspace Admin — Quotas

Base path `/admin/workspace/quotas`. **Auth + workspace admin.** Per-role request caps.

#### `GET /admin/workspace/quotas`
→ **200** service result (current quota rows).

```bash
curl "$BASE/admin/workspace/quotas" \
  -H "Authorization: Bearer $TOKEN"
```

#### `PATCH /admin/workspace/quotas`
Upsert quota rows.

**Request**
```json
{
  "rows": [ { "role": "member", "maxRequests": 1000 } ],
  "force": false
}
```

```bash
curl -X PATCH "$BASE/admin/workspace/quotas" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rows":[{"role":"member","maxRequests":1000}],"force":false}'
```
- `rows`: 1–20 items; `maxRequests` integer 0–1,000,000
- `force`: optional, default `false`

| Status | Body | When |
|--------|------|------|
| 200 | service result | Applied |
| 400 | `invalid_body` | Schema failure |

---

## WebSocket — Chat v2

Real-time streaming chat. Single endpoint:

```
ws://localhost:3000/ws/chat/v2
```

- Any other upgrade path → `404`.
- **Heartbeat:** server pings every 30s; a socket that misses a pong is terminated.
- **Backpressure:** if the socket's buffered amount exceeds ~1 MB, outbound frames are dropped (logged), protecting the server from slow consumers.

### Connecting (wscat)

`curl` cannot drive a streaming WebSocket session, so use [`wscat`](https://github.com/websockets/wscat) (`npm i -g wscat`). Once connected, type JSON frames at the prompt:

```bash
# Dev (current bypass — token ignored):
wscat -c "ws://localhost:3000/ws/chat/v2"

# Intended token flow:
wscat -c "ws://localhost:3000/ws/chat/v2?token=$TOKEN"
```

Then send a chat request frame (paste as one line):

```json
{"type":"c.chat.send","model":"claude-sonnet-4","messages":[{"role":"user","content":"Hello!"}]}
```

You'll receive a stream of `s.chat.started` → `s.chat.token`… → `s.chat.completed` frames. To verify just the handshake/headers with curl:

```bash
curl -i -N \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: $(openssl rand -base64 16)" \
  "$BASE/ws/chat/v2"
```

### Authentication (current behavior)

> The upgrade handler currently runs a **dev-auth bypass** (`src/ws/ws-upgrade-auth.ts`): it returns a seeded dev identity and does **not** verify a token. The token-based path is implemented but commented out.

**Intended (token) flow** — pass the JWT as a query param:
```
ws://localhost:3000/ws/chat/v2?token=<jwt>
```
Missing/invalid token → the server writes `HTTP/1.1 401 Unauthorized` and closes the socket before upgrade.

### Message envelope

All frames are JSON. Client→server types are prefixed `c.`; server→client types `s.`.

### Client → Server messages

**`c.chat.send`** — start/continue a streamed completion.
```jsonc
{
  "type": "c.chat.send",
  "conversationId": "uuid",        // optional; omit to create a new conversation
  "model": "claude-sonnet-4",      // required
  "messages": [                     // required, ≥ 1
    { "role": "user", "content": "Hello!" }
  ],
  "maxTokens": 4096,                // optional, 1..8192
  "temperature": 0.7                // optional, 0..2
}
```
- `messages[].role` ∈ `user | assistant | system | tool`; `content` is a string or array. Optional `name`, `toolCallId`.
- If `conversationId` is omitted, the server resolves the active workspace and creates a conversation, emitting `s.conversation.created`.
- Prior conversation history is prepended server-side before dispatch.

**`c.chat.abort`** — cancel an in-flight request you own.
```json
{ "type": "c.chat.abort", "requestId": "<uuid>" }
```

**`c.ping`** — application-level keepalive → server replies `s.pong`.
```json
{ "type": "c.ping" }
```

### Server → Client messages

| Type | Payload | Meaning |
|------|---------|---------|
| `s.conversation.created` | `{ conversation }` | New conversation created for this send |
| `s.chat.started` | `{ requestId, conversationId, model, startedAt }` | Stream began |
| `s.chat.token` | `{ requestId, delta, index }` | Streaming token delta (ordered by `index`) |
| `s.chat.completed` | `{ requestId, usage, finishReason, latencyMs }` | Stream finished |
| `s.chat.failed` | `{ requestId, code, message }` | Generation failed (see provider codes) |
| `s.chat.aborted` | `{ requestId, reason }` | Aborted; `reason` ∈ `client \| timeout \| manual` |
| `s.pong` | `{}` | Reply to `c.ping` |
| `s.error` | `{ code, message }` | Connection/message-level error |

`requestId` is server-assigned (UUID) and returned via `s.chat.started`/event stream; clients track it to correlate tokens and to abort.

### Connection / message error codes (`s.error`)

| Code | When |
|------|------|
| `invalid_json` | Frame was not valid JSON |
| `invalid_message` | Frame failed schema validation |
| `not_found` | `conversationId` does not exist |
| `forbidden` | Conversation owned by another user, or aborting an unowned request |
| `no_active_workspace` | No active workspace when creating a conversation |

### Provider failure codes (`s.chat.failed`)

Mapped from gateway errors in `src/chat-v2/error-mapper.ts`:

| Code | Source error |
|------|--------------|
| `provider_auth_error` | AuthenticationError |
| `provider_rate_limit` | RateLimitError |
| `provider_timeout` | TimeoutError |
| `provider_unavailable` | CircuitOpenError (circuit breaker open) |
| `all_providers_failed` | FallbackExhaustedError |
| `invalid_request` | ValidationError |
| `model_not_found` | ModelNotFoundError |
| `content_filtered` | ContentFilterError |
| `request_cancelled` | AbortError |
| `internal_error` | Anything else (message sanitized to "An unexpected error occurred") |

---

## Environment Variables

See `README.md` for the full table. Key ones:

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `JWT_SECRET` | **Yes** | — | HS256 signing key |
| `JWT_EXPIRES_IN` | No | `24h` | Token TTL |
| `PORT` | No | `3000` | Server port |
| `RATE_LIMIT_LOGIN_WINDOW_MS` | No | `900000` | Login rate-limit window |
| `RATE_LIMIT_LOGIN_MAX` | No | `5` | Max login attempts / window |

---

## Endpoint Summary

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | none |
| POST | `/auth/login` | none (rate limited) |
| POST | `/auth/register` | none (rate limited) |
| GET | `/api/me/active-workspace` | user |
| GET | `/prompt-templates` | user |
| POST | `/prompt-templates` | system admin |
| PATCH | `/prompt-templates/:id` | system admin |
| DELETE | `/prompt-templates/:id` | system admin |
| GET | `/workspaces` | user |
| POST | `/workspaces` | system admin |
| GET | `/workspaces/:id` | user (role-aware) |
| PATCH | `/workspaces/:id` | system admin |
| DELETE | `/workspaces/:id` | system admin |
| GET | `/admin/org/users` | org admin |
| POST | `/admin/org/users/invite` | org admin |
| POST | `/admin/org/users/:id/disable` | org admin |
| GET | `/admin/org/templates` | org admin |
| POST | `/admin/org/templates` | org admin |
| PATCH | `/admin/org/templates/:id` | org admin |
| DELETE | `/admin/org/templates/:id` | org admin |
| GET | `/admin/org/providers` | org admin |
| POST | `/admin/org/providers` | org admin |
| PATCH | `/admin/org/providers/:id` | org admin |
| POST | `/admin/org/providers/:id/rotate-key` | org admin |
| DELETE | `/admin/org/providers/:id` | org admin |
| GET | `/admin/workspace/members` | workspace admin |
| POST | `/admin/workspace/members/invite` | workspace admin |
| PATCH | `/admin/workspace/members/:id` | workspace admin |
| DELETE | `/admin/workspace/members/:id` | workspace admin |
| GET | `/admin/workspace/roles` | workspace admin |
| GET | `/admin/workspace/providers` | workspace admin |
| PUT | `/admin/workspace/providers` | workspace admin |
| GET | `/admin/workspace/templates` | workspace admin |
| PUT | `/admin/workspace/templates` | workspace admin |
| GET | `/admin/workspace/quotas` | workspace admin |
| PATCH | `/admin/workspace/quotas` | workspace admin |
| WS | `/ws/chat/v2` | dev-bypass (token intended) |
