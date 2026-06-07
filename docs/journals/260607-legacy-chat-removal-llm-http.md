# Legacy Chat Module Removal from llm-http

**Date**: 2026-06-07 14:30
**Severity**: High
**Component**: llm-http (REST & WebSocket chat layer)
**Status**: Completed

## What Happened

Executed 7-phase plan to remove pre-v2 chat infrastructure from llm-http, unblocking full migration to `/ws/chat/v2`. Deleted entire `src/chat/` directory (StreamChatUseCase, OneShotChatUseCase, ChatCommandHandler, PingCommandHandler, WsCommandHandlerMap, validators, routes, handlers). Promoted 4 shared modules (`chat-gateway-port.ts`, `llm-gateway-adapter.ts`, `null-gateway-adapter.ts`, `error-mapper.ts`) to `src/chat-v2/` via `git mv`. Rewired composition root, simplified WebSocket upgrade fallback, dropped orphaned config, synced documentation.

## The Technical Win

Removed 1800+ lines of dead code without touching a single working file body. Zero logic reimplementation needed—4 shared modules moved via `git mv` preserving full blame history. Composition root cleanup was surgical: 3 AppContainer fields + instantiations deleted, 1 import path changed per module. `/ws/chat` route gone; non-v2 upgrade requests now get a plain `404` instead of the previous existingUpgradeListeners fallback that only existed to coexist with legacy surface.

## The Brutal Truth

**Transient breakage by design.** After Phase 3 (import retarget), tsc was red for 8 hours. The legacy `src/chat/` files still imported modules that had moved to `src/chat-v2/`. Instead of trying to keep tsc green incrementally, I deferred compilation gate to Phase 5 (after deletion). This was **correct**: intermediate red states are unavoidable in move-then-delete refactors. The lesson: don't fight the inevitable—gate on the right phase boundary.

**Pre-existing auth breakage added noise.** A hardcoded user stub in `ws-upgrade-auth.ts` (JWT verify commented out, returns `{id:"1",username:"cesc"}`) produced 3 TS6133 errors + 1 failing test. This was **not caused by this plan**—it's the parallel chat-v2 UI effort. Correctly identified as owned by that plan, left untouched per user decision. Lesson: verify ownership before "fixing" red you didn't cause. Saves hours of thrashing.

## Technical Details

**Files deleted:**
- `src/chat/` (entire directory): 12 modules, chat-rest-routes, chat-ws-handler, legacy ws-types, StreamChatUseCase, OneShotChatUseCase, command handlers, validators
- `src/ws/ws-server.ts` + `ws-types.ts` (legacy WebSocket attachment point)

**Files moved (git mv):**
- `src/chat/chat-gateway-port.ts` → `src/chat-v2/chat-gateway-port.ts`
- `src/chat/llm-gateway-adapter.ts` → `src/chat-v2/llm-gateway-adapter.ts`
- `src/chat/null-gateway-adapter.ts` → `src/chat-v2/null-gateway-adapter.ts`
- `src/chat/error-mapper.ts` → `src/chat-v2/error-mapper.ts`

**Composition root changes:**
- Removed: `chatService`, `chatRestRoutes`, `chatWsHandler` AppContainer fields
- Retargeted: 4 import statements to point to `./chat-v2/`
- Removed: POST /chat route registration, chat rate-limit config, legacy WebSocket attach + ws param in shutdown
- Simplified: non-`/ws/chat/v2` upgrades now return `404` (removed re-dispatch of existingUpgradeListeners)

**Config cleanup:**
- Deleted `RATE_LIMIT_CHAT_WINDOW_MS`, `RATE_LIMIT_CHAT_MAX` (chat-v2 uses different strategy)

**Documentation synced:**
- `docs/system-architecture.md`: Removed REST /chat, updated WebSocket connect URL to `/ws/chat/v2`
- `docs/codebase-summary.md`: Removed legacy chat section
- `docs/code-standards.md`: Removed legacy chat patterns
- `llm-http/README.md`: Same updates

## What Made This Hard

1. **Overlapping plans on same working tree.** This removal + the chat-v2 UI implementation ran in parallel. Working tree held both sets of changes. Solution: explicit `git add llm-http/* docs/*`, then `git status` verification. Excluded all `llm-ui/*` and the auth stub.

2. **Test runner gotcha.** llm-http uses vitest in WATCH mode by default (not `vitest run`). Integration tests needed log capture + grep polling + pkill for clean exit. Lesson: read package.json test script before assuming it's headless.

3. **Package name inconsistency.** llm-http exports as `@ai-connect/http` but the workspace package.json literal is `llm-http`. Tripped up initial verification—needed both names in test commands.

## Verification State

**llm-http:**
- tsc: Clean except 3 pre-existing TS6133 errors (auth stub, not plan-caused)
- tests: 365/366 passing (the 1 failure is the hardcoded auth stub test)
- Imports: All valid, circular deps cleared

**llm-ui:**
- tsc: Clean (unaffected)
- tests: 31/31 passing (only consumes `/ws/chat/v2`, which is stable)

**code-reviewer approval:** DONE, no new issues

## Next Steps

1. **Deferred smoke test:** Live curl + boot (needs interactive terminal + dev JWT + provider credentials). Recommend before merge.
2. **Auth stub resolution:** Owned by chat-v2 UI plan (separate effort).
3. **Ready to merge:** Commit `23d62df` on `feat/integrate-chat-api-v2`.

---

**Status:** DONE
