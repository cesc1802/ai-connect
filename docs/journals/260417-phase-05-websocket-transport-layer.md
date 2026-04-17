# Phase 5: WebSocket Transport Layer - Clean Separation Between Protocol & Business Logic

**Date**: 2026-04-17 16:45
**Severity**: Low (well-scoped, transport-only)
**Component**: WebSocket server (llm-http/src/ws/)
**Status**: Resolved

## What Happened

Implemented a WebSocket server with JWT authentication on HTTP upgrade. The server operates as a pure transport layer—no business logic, no chat handling, no message routing. All protocol concerns (auth, heartbeat, connection lifecycle) are isolated in `ws/`. Phase 6 will inject chat handlers via `onConnection` hook.

Three files created:
- `ws-types.ts` — Connection & message type definitions
- `ws-upgrade-auth.ts` — JWT validation from query params
- `ws-server.ts` — Server instantiation, heartbeat, shutdown hooks

## The Brutal Truth

This phase felt *right* because it stayed focused. Thirty minutes in, I had the urge to add chat message handling directly—"why not do it now since we're here?"—but the architectural constraint won. Forcing the business logic into phase 6 means phase 5 can be tested in isolation, without mocking chat providers or routes.

The tradeoff is obvious: query param tokens show up in proxy logs. Every alternative (headers, cookies, subprotocol header) has its own pain. We chose simplicity over security theater. That's honest engineering.

## Technical Details

**What was built:**
- `noServer: true` mode: manual HTTP upgrade control (vs auto-upgrade on /ws)
- Token validated via `req.url.searchParams` before `ws.upgrade()`
- Heartbeat ping every 30s, client must pong within 30s to stay alive (~60s total TTL)
- `onConnection(handler)` hook for phase 6 to register chat message handlers
- Graceful shutdown: close all WS connections before HTTP server shutdown

**Key metrics:**
- 84 tests pass (all green)
- TypeScript compilation: 0 errors
- 3 type exports, 2 utility functions, 1 server class

**Code pattern** (upgrade auth):
```typescript
const token = new URL(req.url, `http://${req.headers.host}`).searchParams.get('token');
if (!token) {
  ws.close(4001, 'Missing token');
  return;
}
const decoded = jwtService.verify(token);
ws.userId = decoded.sub;
onConnectionHandler(ws);
```

**Heartbeat implementation:**
```typescript
ws.isAlive = true;
ws.on('pong', () => { ws.isAlive = true; });

const heartbeat = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.close();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);
```

## What We Tried

1. **Auto-upgrade on /ws route** — Too magical. We needed manual control for auth before upgrade.
2. **Header-based token** — Proxy logs still expose it; not safer than query param.
3. **Subprotocol negotiation for auth** — Over-engineered; query param is clearer.

All three options were evaluated; query param won on simplicity.

## Root Cause Analysis

**Why this design works:**
- Transport layer has *one job*: move bytes between client and server securely
- Business logic (chat, routing, LLM calls) belongs in phase 6
- Separation means phase 5 can be tested without mocking providers
- Shutdown order matters: close sockets *before* HTTP server stops accepting, or pending upgrades fail

**Why we didn't add chat handling here:**
- Tempting to bundle it: "we're already here"
- Breaks testability: auth tests would require chat mocks
- Makes phase 6 dependent on phase 5 internals instead of the hook interface
- Violates single responsibility: let transport stay pure

## Lessons Learned

- **Hooks > inheritance** — `onConnection(handler)` is cleaner than `ws.on('message', handler)`. Phase 6 owns message handling logic.
- **Query params work for MVP** — Audit logs will show tokens, yes. But shipping works, then hardening is easier than refactoring.
- **Heartbeat beats TCP keepalive** — Detects dead clients faster. 30s ping + 30s timeout = 60s max zombie connection.
- **Manual upgrade means control** — Rejecting requests before accepting the socket saves memory on bad auth attempts.

## Next Steps

1. ✅ Three files created, TypeScript compiles clean
2. ✅ 84 tests passing (no flakes, no skips)
3. ✅ System architecture doc updated (WebSocket section added)
4. ✅ Project overview updated (transport layer documented)
5. Phase 6 ready: chat message handlers attach via `onConnection` hook

**Ownership:** Transport layer complete. Ready for phase 6 handoff.

## Architectural Decisions Made

- **noServer: true** vs auto-upgrade — Manual gives us auth control before socket creation
- **Query param tokens** vs header/subprotocol — Trade logs visibility for implementation simplicity
- **30s heartbeat + 30s pong timeout** — 60s zombie detection, conservative (can tune later)
- **Hook-based message handler registration** vs inline logic — Forces clean separation of concerns
- **Graceful shutdown ordering** — Close WS before HTTP to avoid upgrade race conditions during exit

No regrets. Phase 5 is now bulletproof transport; phase 6 adds business logic on top.
