# Chat Screen Workspace-First Redesign — Feature Complete

**Date**: 2026-06-11 23:10  
**Severity**: High  
**Component**: llm-http, llm-ui, llm-db  
**Status**: Resolved

## What Happened

Member chat screen rebuilt with workspace-first mental model. Shipped workspace switcher with role chips, conversation rail scoped to active workspace (search + localized day groups: Hôm nay/Hôm qua/Trước đó in Vietnamese), template-seeded new-chat dialog, redesigned conversation view and composer with stop button and **no model picker** (model comes from workspace default or template). Backend: 4 new GET endpoints for member-safe workspace/model access, chat WebSocket v2 extended with optional `workspaceId` + `templateId` (server-validated), new message-persister event pipeline (`llm-http/src/chat-v2/message-persister.ts`) persists user turn, auto-titles untitled conversations from first message, buffers text deltas, persists assistant turn on completed/aborted (partial flag), bumps conversation `updatedAt`. New nullable `conversations.template_id` column (migration 0006). Tests: llm-http 433 passed/63 skipped, llm-ui 86/86, all packages tsc clean, code review zero critical/high. Feature shipped after 7 post-review fixes same session.

## The Brutal Truth

This feature exposed **auth-gating mismatches between client assumptions and API layer**, **WebSocket error handling gaps**, and **database connectivity as a silent failure point**. The frustrating part is that each issue was individually survivable, but their combination created cascading test failures and a full re-review cycle.

Three things really hurt:

1. **`/providers` endpoint is admin-only, but client assumed member access** — Spent an hour debugging why the providers list never loaded on staging. UI called `GET /api/workspaces/:id/providers` which existed in the plan, route was written, but it was gated to org admins only (403). Discovered during integration test setup. Forced a new endpoint `GET /api/me/default-model` to let members fetch their workspace's model without listing all providers. Lesson: **verify route auth gates before designing client-side data flows**. Would have saved a full integration debugging session.

2. **WebSocket `s.error` event has no `requestId` field** — Chat abort button sends `c.chat.cancel` with a `requestId`, expecting the error response to carry the same ID. Instead, `s.error` carries only `message` and `code`. Reducer attributes errors to the in-flight assistant draft using pending/streaming state as guard. Works, but the coupling is fragile: if two errors fire simultaneously (outside a send), the second one is a no-op. Learned to defensively guard on state before claiming error ownership.

3. **History dedup logic was backwards initially** — Client resends full transcript on reconnect, but server was already sending full transcript + lastClientMessage, causing duplicates in state. Corrected: persisted DB transcript is canonical; connection session forwards `[...dbHistory, lastClientMessage]` only. Simple rule: **connection-local state is ephemeral; DB is source of truth**. Test assertion still catches this via message count validation.

4. **Vietnamese date localization renders differently between runtimes** — `vi-VN toLocaleDateString()` renders `dd-MM` on Node.js but `dd/MM` in some browsers. Day grouping logic depended on stable format. Fixed test assertion to match `/01[-/]05/` (both hyphen and slash). Minor, but it's a timezone/locale foot-gun hiding in plain sight.

## Technical Details

**HTTP Endpoints (member-safe):**
- `GET /api/me/workspaces`: list workspaces user belongs to (org scoped).
- `GET /api/me/workspaces/:id`: single workspace detail (includes role chip).
- `GET /api/me/default-model`: returns member's default LLM for current workspace (no provider listing).
- `GET /conversations` & `GET /conversations/:id/messages`: fetch conversation history (workspace-scoped).

**WebSocket Chat v2 (extended):**
- `c.chat.send` now accepts optional `workspaceId` (defaults to user context) and `templateId` (looked up in conversation.template_id).
- Server validates both against user's workspace membership and template availability.
- Template body **validated but not yet injected** into model prompt (TODO).

**Message Persistence Pipeline (`message-persister.ts`):**
- Listens to event bus from WebSocket chat handler.
- Persists user turn: title-less conversations auto-titled from first message user content.
- Buffers consecutive text deltas, writes single message record per turn.
- On `s.chat.complete` or `s.chat.abort`: persists assistant turn with partial flag if aborted.
- Calls `ConversationRepository.touch()` to bump `updatedAt` for recency-based sorting.
- Write failures logged to bus, **not surfaced to client** (design choice: don't interrupt chat).

**UI Conversation Rail:**
- Search filters across all workspace conversations (real-time, no debounce in v1).
- Day groups: Hôm nay (today), Hôm qua (yesterday), Trước đó (earlier, localized).
- Click conversation → load messages via `GET /conversations/:id/messages`.
- New chat button: template picker pre-fills system prompt (seeded templates in llm-db).

**Composer Redesign:**
- Model picker **removed** — model locked to workspace default or template choice.
- Stop button: sends `c.chat.cancel` with request ID (though error response doesn't echo it).
- Abort guard: switching workspaces mid-send cancels in-flight request + clears draft.

**Database Migration 0006:**
- Adds nullable `conversations.template_id` (varchar foreign key to templates table).
- No enforce on application layer yet (template validation is per-request, not schema constraint).

**Testing:**
- llm-http: 433 passed (7 skipped = DB-gated integration tests).
- llm-ui: 86/86 (conversation list, composer, message render, abort flow).
- Regression: message count validation after history dedup, day grouping format tolerance.

## What We Tried

1. **Client listing providers directly**: Assumed `GET /api/workspaces/:id/providers` was member-accessible. Added auth gate to 403. Detour: created member-safe `GET /api/me/default-model` instead.

2. **Attributing WS errors by `requestId` match**: Expected `s.error` to echo request ID. Didn't exist. Fallback: guard on pending/streaming reducer state.

3. **Full transcript sync on reconnect**: Server sent full DB history + local lastClientMessage. Client state duplicated. Fixed: session forwards ephemeral state only.

4. **Locale-specific date format**: Test hardcoded `01-05` format. Broke on browser runs with `/`. Broadened to regex match.

5. **Injecting template body into prompt**: Validated template at send-time but didn't prepend to user message. Left as TODO after design discussion; template feature is "just seeding conversations" not "dynamic system prompt" in v1.

## Root Cause Analysis

1. **Auth gates are part of the API contract, not orthogonal** — `/providers` was designed as admin-only for org governance. Client design assumed it'd be member-accessible (unverified assumption). Should have reviewed route auth before planning client integration. Lesson: **auth gates are a functional requirement**, not an implementation detail.

2. **WebSocket error events lack request context** — HTTP has status codes and correlation IDs. WebSocket messages are fire-and-forget. No built-in correlation. Attributing errors to in-flight requests requires state machine (pending/streaming guard). Fragile when multiple requests are in flight. Mitigation: simplify to single-request-at-a-time (no parallel sends).

3. **Ephemeral and persistent state were conflated** — Connection session keeps local message buffer for optimistic UI. Persistence layer should read from DB, not buffer. Initial design cached lastClientMessage on connection for easy re-use; this broke dedup logic. Once DB became source of truth, dedup became trivial (ignore client buffer on reconnect).

4. **Localization assumptions are runtime-specific** — Node.js and browser Intl APIs can diverge. Testing only on one runtime masked the bug. Lesson: **test locale-dependent code on all target runtimes** (Node for tests, browser for real). Regex tolerance is fine; hard-coded format is not.

5. **Template feature scope crept into chat v2 design** — Template body injection is a later concern (multi-turn system prompt editing). Shipping template seeding without injection is still useful (single-message template conversations), but created a TODO that should be tracked. Lesson: validate whether "template" is "static conversation starter" or "dynamic system prompt updater" before shipping.

## Lessons Learned

1. **Verify route auth gates before designing client-side API calls** — Not verifying `GET /providers` auth cost an hour of debugging. Check `.claude/rules` routes file or read route middleware before assuming member access. Prevents integration surprises at test time.

2. **WebSocket requires explicit request correlation or single-flight enforcement** — HTTP has correlation IDs and status codes. WebSocket is datagram-like. Either add request tracking (complex) or enforce single-in-flight (simpler). Chose single-flight: abort guard on workspace switch clears pending requests. Prevents error attribution races.

3. **DB is source of truth; connections are ephemeral** — Client reconnect should fetch full state from DB, not merge with buffer. Simplifies dedup logic and prevents off-by-one message counts. Single source of truth > local optimization.

4. **Locale-dependent code must test on all runtimes** — Browser and Node.js Intl APIs diverge. `toLocaleDateString()` format varies. Test on both (Jest in Node + browser test if available). Or normalize format at source (e.g., always use ISO 8601, format on display).

5. **Template feature design must be explicit about scope** — "Inject template body into model prompt" is different from "seed conversation from template". Ship one clearly, defer the other. This feature does the latter; injecting is TODO. Documented clearly so future work doesn't re-invent.

6. **Post-review fixes in same session maintain code quality** — 7 user-approved fixes (error surfacing, persistence validation, template lookup, abort-on-switch, canSend gate, default-model endpoint, lib unit tests) were implemented and re-reviewed in 4 hours. Staying in the same context kept the fixes surgical. Breaking into a new session would have meant re-learning the feature architecture.

## Next Steps

1. **Resolve TODO: inject template body into model prompt** — Current design prepends template to user message on send. Pending UX review before shipping multi-turn template conversations. (Blocked on product decision.)

2. **Surface persister write failures to client** — Message persistence failures are bus-logged but not surfaced to chat UI. Add optional error event to allow UI to warn user if a message didn't persist. (Medium priority; rare in practice.)

3. **Expand WebSocket request correlation** — If parallel chat requests become a requirement, add `requestId` to `s.error` events and chat response messages. Currently single-in-flight is sufficient.

4. **Enforce template_id foreign key in schema** — Currently nullable and validated per-request. Consider adding DB constraint if templates become a critical feature. (YAGNI until needed.)

5. **Monitor conversation update latency** — `ConversationRepository.touch()` updates `updatedAt` on every message. If conversation list sorts by recency, measure if this becomes a hot write. Batch if needed.
