# Phase 6: Chat Streaming Handler - Command Pattern for Message Routing

**Date**: 2026-04-17 17:30
**Severity**: High (core LLM streaming logic)
**Component**: WebSocket chat handlers (llm-http/src/chat/)
**Status**: Resolved

## What Happened

Implemented the chat streaming layer using the Command Pattern. Each WebSocket message type (ping, chat) gets its own handler class. The StreamChatUseCase orchestrates streaming via ChatGatewayPort, never importing llm-gateway directly. Single-stream-per-socket policy enforced: new chat aborts the previous stream cleanly.

Seven files created:
- `chat-message-validator.ts` — Zod schemas for ClientMessage validation
- `error-mapper.ts` — Provider error to safe code mapping with sanitization
- `stream-chat-use-case.ts` — Streaming orchestration with AbortController
- `chat-ws-handler.ts` — WS router with backpressure (1MB) and message size limit
- `ws-command-handler.ts` — Command pattern interface
- `ping-command-handler.ts` — Ping/pong handler
- `chat-command-handler.ts` — Chat streaming handler

## The Brutal Truth

The frustrating part: we had to add error sanitization *after* code review flagged it. Returning raw provider errors to clients is a security hole—clients see internal stack traces, database names, API endpoints. That's embarrassing and dangerous. The fix was straightforward (sanitize + log real error server-side), but it should have been in from the start.

The exhausting part: mapping every provider error type to a safe code is tedious. ValidationError, ModelNotFoundError, RateLimitError, etc.—each needs its own case. But it's necessary. Better tedious than leaking secrets.

The relieving part: AbortController works perfectly for cleaning up streams. New chat request comes in? Abort the old one. Done. No dangling promises, no memory leaks.

## Technical Details

**Architecture decisions that held:**
- Command Pattern: each message type (`ping`, `chat`) has its own handler class implementing `WsCommandHandler<T>`
- UseCase layer depends on `ChatGatewayPort` interface, not concrete llm-gateway implementation
- Single-stream-per-socket: `StreamHandle` stored in socket, new chat aborts previous via `controller.abort()`
- AbortController ownership in StreamHandle for clean signal propagation to LLM provider

**Key metrics:**
- 247 tests passing (6 new test suites for Phase 6)
- TypeScript compilation: 0 errors
- Backpressure threshold at 1MB `bufferedAmount`
- Message size limit at 1MB to prevent DoS attacks
- Error sanitization: internal errors → generic "Internal error" to client, real error logged server-side

**Code pattern** (command routing):
```typescript
async handle(ws: ChatWebSocket, message: ClientMessage): Promise<void> {
  const handler = this.getHandler(message.type);
  if (!handler) {
    ws.send(JSON.stringify({ type: 'error', code: 'UNKNOWN_MESSAGE_TYPE' }));
    return;
  }
  await handler.execute(ws, message);
}
```

**Error sanitization example:**
```typescript
export const mapProviderError = (error: unknown): { code: string; message: string } => {
  if (error instanceof ValidationError) {
    return { code: 'VALIDATION_ERROR', message: 'Invalid message format' };
  }
  if (error instanceof ModelNotFoundError) {
    return { code: 'MODEL_NOT_FOUND', message: 'Requested model is not available' };
  }
  // Internal errors always return generic message
  return { code: 'INTERNAL_ERROR', message: 'Internal error' };
};
```

**Backpressure handling:**
```typescript
if (ws.bufferedAmount > 1_000_000) {
  // Pause LLM stream, wait for client to drain
  return; // Don't push more data
}
```

## What We Tried

1. **Async/await streaming directly in handlers** — Tempting but messy. UseCase layer decouples logic from WS protocol details.
2. **Multiple streams per socket** — Complexity nightmare. Single-stream policy keeps state management trivial.
3. **Error pass-through** — Security disaster. Sanitization was mandatory after review.
4. **Manual error mapping without a mapper function** — Copy-paste bugs everywhere. Centralized `error-mapper.ts` is cleaner.

## Root Cause Analysis

**Why this design works:**
- Command Pattern naturally encapsulates message handling logic per type
- UseCase layer depends on interface (`ChatGatewayPort`), not implementation—swappable for testing
- AbortController is exactly what streaming cancellation needs: signal + cleanup
- Single-stream policy eliminates race conditions between concurrent chat requests
- Backpressure at bufferedAmount threshold prevents server memory explosion

**Why we almost shipped with error leaks:**
- Easy to forget: internal error details are a feature for debugging, a vulnerability for clients
- Code review caught it. That's how process works. No shame in the catch.
- Centralized error-mapper means it's fixable in one place.

## Lessons Learned

- **Command Pattern fits WebSocket message routing perfectly** — Each handler owns its message type. No big switch statement. Add new message types by adding new handler classes.
- **UseCase layer as a dependency boundary** — Depend on interface, not concrete providers. Testable without spinning up LLM gateway.
- **Sanitization must be default** — Assume all errors are secrets until proven safe. Better to be defensive than to leak.
- **AbortController is the right primitive for streaming** — Not setTimeout, not flags. The abort signal propagates through async chains automatically.
- **Backpressure is non-negotiable** — 1MB bufferedAmount threshold catches runaway streams before they crash the server.
- **Message size limits prevent DoS** — 1MB max per message. Simple, effective, measurable.

## Next Steps

1. ✅ Seven files created, TypeScript compiles clean
2. ✅ 247 tests passing (6 new test suites, all green)
3. ✅ Error sanitization added and verified
4. ✅ Code review findings addressed (message size limit, missing error types)
5. ✅ Commit: `335e9bf feat(llm-http): implement chat streaming handler with command pattern`
6. Phase 7 ready: resilience patterns (retry, circuit breaker) wrap the streaming layer

**Ownership:** Chat streaming handler complete. StreamChatUseCase is the integration point for phase 7.

## Architectural Decisions Made

- **Command Pattern** vs explicit switch on message.type — Extensible, testable, clean separation
- **UseCase layer depends on ChatGatewayPort** vs direct llm-gateway import — Inversion of control, testability
- **Single-stream-per-socket** vs concurrent streams — Simplicity + clear semantics for the client
- **AbortController in StreamHandle** vs boolean flag — Automatic propagation, no cleanup bugs
- **Centralized error-mapper** vs inline error handling — Consistency, auditability, single point of change
- **1MB backpressure threshold** vs reactive tuning — Conservative default, can adjust after observing real traffic
- **1MB message size limit** vs unlimited — DoS prevention, aligned with backpressure threshold

No regrets. Phase 6 adds real chat streaming on top of the phase 5 transport layer. The command pattern scales cleanly for future message types (file upload, presence, typing indicators). Error sanitization is in place. Tests are solid.
