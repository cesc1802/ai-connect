# Event-Driven Chat Architecture: Brainstorm & Plan Session

**Date**: 2026-04-19 19:58 (Asia/Saigon)
**Severity**: Medium
**Component**: Architecture / Planning
**Status**: Phases 1-5 Complete (6-7 In Progress)

## Session Outcome

Completed brainstorm → plan workflow for event-driven `/ws/chat/v2` architecture. No code written. Plan locked via user approval. 7 phased tasks created; 2 subagents (Explore scout, Planner) completed without failure.

## Decisions Locked

- **Full spec implementation**: All 4 side-effect handlers (Persistence, Title, Cost, Metrics)
- **Persistence deferred**: In-memory repos + real interfaces (DB plan as separate effort)
- **Versioning strategy**: New `/ws/chat/v2`; old `/ws/chat` marked deprecated (untouched)
- **Transport**: Local only; MessageRouter/ConnectionRegistry abstractions for future Redis swap
- **Auth**: Reuse existing JWT-at-upgrade via query param (skip spec's `c.auth` first-message approach)
- **Feature scope v1**: Text streaming + tool calls + thinking deltas + multi-tab title push
- **Shared code layout**: Event types in `@ai-connect/shared`; runtime in `llm-http`

## Risks Flagged

1. **llm-gateway StreamDelta shape unconfirmed** → Phase 4 includes SPIKE task before handler implementation
2. **In-memory repos blocking prod deployment** → Phase 7 adds README warning; DB plan required before release
3. **TitleHandler vs PersistenceHandler ordering unresolved** → Decision needed before Phase 6
4. **MetricsHandler.latencies unbounded** → Corrected to bounded ring buffer (10k samples)

## Notable Call

Rejected YAGNI shortcut on transport abstraction. User approved interface tax (~30 LOC) vs Redis rewrite risk. Right tradeoff.

## Artifacts

- Brainstorm report: `plans/reports/brainstorm-260419-1958-event-driven-chat-architecture.md`
- Plan directory: `docs/journals/`
  - `260419-event-driven-chat-architecture-plan.md` (this overview)
  - Phase files (journals, status updated as completed):
    - ✅ `260419-phase-01-event-driven-foundation.md` — Resolved
    - ✅ `260419-phase-02-local-connection-manager.md` — Resolved
    - ✅ `260419-phase-03-in-memory-repositories.md` — Resolved
    - ✅ `260419-phase-04-chat-handler-event-driven.md` — Resolved
    - ✅ `260419-phase-05-websocket-server-v2-bridge.md` — **Resolved** (4 modules, 48 tests, e2e verified)
    - `260419-phase-06-side-effect-handlers.md` — Pending
    - `260419-phase-07-integration-and-documentation.md` — Pending
- 7 hydrated tasks (#1–#7) in shared TaskList

## Unresolved Questions for Next Phase

1. Path guard merge order: Phase 5 vs Phase 7?
2. History prepend strategy: Server-side confirmed; need UI impact assessment
3. `s.error` vs `s.chat.failed` channel split: Which events map where?
4. Phase 7 integration tests: Currently optional; recommend mandatory for v1 stability
5. Handler execution order: TitleHandler blocking PersistenceHandler or parallel?
