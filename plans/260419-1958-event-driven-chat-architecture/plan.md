---
title: "Event-Driven Chat Architecture"
description: "EventBus + decoupled handlers + new /ws/chat/v2 endpoint, alongside existing chat handler"
status: in-progress
priority: P1
effort: 24h
progress: 29%
branch: master
tags: [event-driven, websocket, eventbus, chat, llm-http]
created: 2026-04-19
blockedBy: []
blocks: []
brainstormReport: ../reports/brainstorm-260419-1958-event-driven-chat-architecture.md
---

# Plan — Event-Driven Chat Architecture

## Overview
Introduce typed in-process EventBus + decoupled side-effect handlers in `llm-http`. New `/ws/chat/v2` endpoint coexists with existing `/ws/chat`. Foundation event types live in `@ai-connect/shared`. Persistence + transport behind interfaces (in-memory now, swap later). Zero breakage of existing endpoints.

## Dependencies
- `llm-gateway` (existing) — streaming chunks consumed by Phase 4
- `@ai-connect/shared` (existing) — extended in Phase 1 with event/repo types
- `llm-http` (existing) — primary work site, all phases
- Future: `llm-db` package (out of scope) — swaps in persistent repos via Phase 3 interfaces

## Phases

| # | Phase | File | Effort | Status |
|---|---|---|---|---|
| 1 | Foundation: event types + EventBus + transport interfaces | [phase-01-foundation-event-types-and-bus.md](phase-01-foundation-event-types-and-bus.md) | 3h | completed |
| 2 | Local connection manager (registry + router) | [phase-02-local-connection-manager.md](phase-02-local-connection-manager.md) | 2h | completed |
| 3 | In-memory repositories (conversation + message) | [phase-03-in-memory-repositories.md](phase-03-in-memory-repositories.md) | 2h | completed |
| 4 | ChatHandler — event-driven gateway streaming | [phase-04-chat-handler-event-driven.md](phase-04-chat-handler-event-driven.md) | 5h | pending |
| 5 | `/ws/chat/v2` server bridge | [phase-05-websocket-server-v2-bridge.md](phase-05-websocket-server-v2-bridge.md) | 5h | pending |
| 6 | Side-effect handlers (Persistence, Title, Cost, Metrics) | [phase-06-side-effect-handlers.md](phase-06-side-effect-handlers.md) | 5h | pending |
| 7 | Composition root wiring + `/api/metrics` + docs | [phase-07-composition-root-metrics-and-docs.md](phase-07-composition-root-metrics-and-docs.md) | 2h | pending |

Phase order is sequential except Phase 6 — the four side-effect handlers are independent and could be parallelized during implementation.

## Key Risks
- **Gateway chunk shape mismatch** — Phase 4 spike confirms `StreamDelta` shape (`text | tool_call_start | tool_call_delta`) vs spec's `text | thinking | tool_use_*` before locking handler impl
- **In-memory repos lost on restart** — README warning + DO NOT DEPLOY v2 to prod until DB plan ships (Phase 7)
- **Two protocols during migration** — feature parity matrix in PR; deprecation timeline TBD (suggest 2 minor versions after v2 stable)

## Success Criteria (rolled up from phases)
- All Vitest suites green per phase + integration test against real `ws` client
- `/ws/chat/v2` end-to-end: c.chat.send → s.chat.started + token stream + s.chat.completed
- Abort: c.chat.abort mid-stream → s.chat.aborted + persisted message with `partial: true`
- Title push: 2 sims for same user → both receive `s.conversation.title_generated`
- `/api/metrics` returns request count + p95 latency
- Old `/ws/chat` + `/chat` REST tests still green (no regression)
- `tsc --noEmit` clean across packages
