# Phase 04 — ChatHandler (Event-Driven Gateway Streaming)

## Context Links
- Brainstorm: `../reports/brainstorm-260419-1958-event-driven-chat-architecture.md`
- Phase 1: event types + EventBus
- Existing pattern reference (do NOT modify): `llm-http/src/chat/stream-chat-use-case.ts` (AbortController loop), `llm-http/src/chat/handlers/chat-command-handler.ts` (callback flow)
- Gateway streaming source: `llm-gateway/src/core/types.ts` `StreamChunk` + `StreamDelta`

## Overview
- **Priority:** P1 (core engine of v2)
- **Status:** completed
- **Description:** New `ChatHandler` subscribes to `chat.requested` events, calls `ChatGatewayPort.stream`, maps gateway chunks to `TokenDelta`s, emits `stream.started` / `token.generated` / `stream.completed` / `stream.failed` / `stream.aborted` events. Tracks active streams by `requestId` for abort. Independent from WebSocket layer.

## Key Insights
- **SPIKE TASK FIRST** — confirm gateway `StreamDelta` shape (`text | tool_call_start | tool_call_delta`) vs spec's `text | thinking | tool_use_*` BEFORE writing handler. Adapter only if shapes diverge for thinking deltas. Gateway code has NO thinking delta type today → adapter required ONLY when added; for now map text 1:1 and tool_call_* → tool_use_*.
- Reuses existing `ChatGatewayPort` (no need for new port)
- Uses existing `mapErrorToCode` + `sanitizeErrorMessage` from `llm-http/src/chat/error-mapper.ts` (DRY)
- Active streams tracked in `Map<requestId, AbortController>` — Phase 5 server publishes a synthetic abort signal, handler triggers abort
- Latency timer started at `stream.started`, captured at `stream.completed`

## Requirements
**Functional**
- Subscribe to `chat.requested` → invoke gateway stream
- Emit `stream.started` immediately before first await
- For each gateway chunk, emit `token.generated` with mapped `TokenDelta` + monotonic `index`
- On stream finish (finishReason + usage present): emit `stream.completed` with `latencyMs`
- On error: emit `stream.failed` with mapped code/message
- On abort (controller.signal.aborted): emit `stream.aborted` with `reason`
- Public method `abort(requestId, reason)` triggers abort for an active stream
- Provide `dispose()` that aborts all in-flight + unsubscribes from bus

**Non-functional**
- File <200 LOC; split adapter to `gateway-chunk-adapter.ts` if needed
- Strict mode, no `any`
- No socket / no transport coupling

## Architecture
```
EventBus.publish("chat.requested", e)
       ↓ subscriber
ChatHandler.onChatRequested(e)
  → bus.publish("stream.started", ...)
  → gateway.stream(req, signal)  (existing ChatGatewayPort)
     for chunk:
       → adaptChunkToTokenDelta(chunk) → bus.publish("token.generated", ...)
       if chunk.finishReason: → bus.publish("stream.completed", ...)
  → catch err: bus.publish("stream.failed" | "stream.aborted", ...)
  → finally: activeStreams.delete(requestId)
```

## Related Code Files
**Create:**
- `llm-http/src/chat-v2/chat-handler.ts`
- `llm-http/src/chat-v2/gateway-chunk-adapter.ts` (only if spike confirms divergence)
- `llm-http/src/chat-v2/__tests__/chat-handler.test.ts`
- `llm-http/src/chat-v2/__tests__/gateway-chunk-adapter.test.ts` (if adapter created)

**Modify:** none

**Delete:** none

**Read for reference (do not modify):**
- `llm-http/src/chat/stream-chat-use-case.ts`
- `llm-http/src/chat/error-mapper.ts`
- `llm-gateway/src/core/types.ts`

## Implementation Steps

### Step 0 — SPIKE (BEFORE coding handler)
Read `llm-gateway/src/core/types.ts` lines 100-115. Confirm `StreamDelta` is exactly `text | tool_call_start | tool_call_delta`. If yes:
- map `text` → `{ kind: "text", text }`
- map `tool_call_start` → `{ kind: "tool_use_start", toolCallId, name }`
- map `tool_call_delta` → `{ kind: "tool_use_delta", toolCallId, arguments }`
- `thinking` deltas: gateway does not emit them today → no adapter row needed; document as "future-extension" comment
Write the adapter inline in `chat-handler.ts` if it stays <30 LOC; extract to `gateway-chunk-adapter.ts` only if it grows.

### Step 1 — Implement `ChatHandler`
```ts
export class ChatHandler {
  private active = new Map<string, AbortController>();
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly bus: EventBus<ChatEvent>,
    private readonly gateway: ChatGatewayPort,
    private readonly logger: Logger,
  ) {}

  start(): void {
    this.unsubscribe = this.bus.subscribe("chat.requested", (e) => this.onChatRequested(e));
  }

  abort(requestId: string, reason: "client" | "timeout" | "manual" = "manual"): void {
    const ctrl = this.active.get(requestId);
    if (!ctrl) return;
    (ctrl as AbortController & { _reason?: string })._reason = reason;
    ctrl.abort();
  }

  async dispose(): Promise<void> {
    this.unsubscribe?.();
    for (const ctrl of this.active.values()) ctrl.abort();
    this.active.clear();
  }

  private async onChatRequested(e: Extract<ChatEvent, { type: "chat.requested" }>): Promise<void> {
    const ctrl = new AbortController();
    this.active.set(e.requestId, ctrl);
    const startedAt = Date.now();
    await this.bus.publish({ type: "stream.started", requestId: e.requestId, userId: e.userId, conversationId: e.conversationId, model: e.model, startedAt });

    let index = 0;
    try {
      for await (const chunk of this.gateway.stream({ model: e.model, messages: e.messages, maxTokens: e.maxTokens ?? 4096, temperature: e.temperature }, ctrl.signal)) {
        const delta = adaptChunkToTokenDelta(chunk);
        if (delta) {
          await this.bus.publish({ type: "token.generated", requestId: e.requestId, delta, index: index++ });
        }
        if (chunk.finishReason && chunk.usage) {
          await this.bus.publish({ type: "stream.completed", requestId: e.requestId, usage: chunk.usage, finishReason: chunk.finishReason, latencyMs: Date.now() - startedAt });
        }
      }
    } catch (err) {
      if (ctrl.signal.aborted) {
        const reason = ((ctrl as { _reason?: string })._reason ?? "client") as "client" | "timeout" | "manual";
        await this.bus.publish({ type: "stream.aborted", requestId: e.requestId, reason });
      } else {
        const error = err as Error;
        await this.bus.publish({ type: "stream.failed", requestId: e.requestId, code: mapErrorToCode(error), message: sanitizeErrorMessage(error) });
      }
    } finally {
      this.active.delete(e.requestId);
    }
  }
}
```

### Step 2 — Adapter helper
Inline (or in `gateway-chunk-adapter.ts` if extracted): convert `StreamDelta | undefined` → `TokenDelta | null`. Return `null` for chunks with no delta (e.g. final chunk carrying only usage/finishReason).

### Step 3 — Tests (`chat-handler.test.ts`)
Use fake `ChatGatewayPort` (vi.fn() per method, NO `vi.mock`):
- happy path: 2 text chunks + final usage → emits `stream.started`, 2× `token.generated`, `stream.completed`
- index increments monotonically
- gateway throws → `stream.failed` with mapped code
- abort during stream → `stream.aborted` with `reason: "manual"` when called via `handler.abort(requestId)`
- abort with no active stream — no throw, no event
- `dispose` aborts all in-flight + unsubscribes (verify by re-publishing `chat.requested` after dispose → handler not invoked)
- tool_call_start chunk → emits `token.generated` with `kind: "tool_use_start"`
- chunks with no delta and no finish are dropped (no event)

### Step 4 — Verify
- `pnpm tsc --noEmit` clean in llm-http
- `pnpm vitest run llm-http/src/chat-v2` — all green

## Todo List
- [x] SPIKE: confirm gateway StreamDelta shape vs spec
- [x] Implement `adaptChunkToTokenDelta` (inline or separate file)
- [x] Implement `ChatHandler` with subscribe/abort/dispose
- [x] Wire `mapErrorToCode` + `sanitizeErrorMessage` reuse
- [x] Tests: happy path, error, abort, tool_call, empty chunk, dispose
- [x] `tsc --noEmit` + vitest green

## Success Criteria
- Spike documented in PR description (one-line: "confirmed StreamDelta shape; no adapter file needed" OR "adapter required for X")
- All tests pass with fake gateway (no `vi.mock`)
- File <200 LOC
- No imports from `chat/` (existing handler) — fully decoupled
- Abort propagation verified end-to-end via test

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Gateway chunk shape diverges from event TokenDelta | Med | Med | Step 0 spike + adapter file ready |
| Abort race (chunk arrives between abort and signal check) | Low | Low | Existing pattern in `stream-chat-use-case.ts` works — replicate |
| EventBus `Promise.allSettled` swallows handler errors | Med | Med | Phase 1 logs at warn; integration test in Phase 5 verifies error events still routed |
| Active stream leak if `chat.requested` published twice with same requestId | Low | Med | Document: requestId must be unique per call (Phase 5 generates via uuid) |

## Security Considerations
- No PII logged: only requestId + userId + model
- `userId` carried through to all downstream events for handler-level scoping
- Error messages sanitized via existing `sanitizeErrorMessage` (no provider stack traces leaked)
- Abort cannot be triggered for another user's requestId — Phase 5 enforces (only abort own session's active requestId)

## Next Steps
- **Depends on:** Phase 1 (EventBus + types)
- **Blocks:** Phase 5 (server publishes `chat.requested` and consumes downstream events), Phase 6 (handlers subscribe to same events)
- **Follow-up:** if `llm-gateway` adds thinking deltas later, extend adapter only — handler unchanged
