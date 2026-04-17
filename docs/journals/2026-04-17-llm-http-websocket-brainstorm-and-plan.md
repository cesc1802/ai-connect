# LLM-HTTP WebSocket Layer: Brainstorm + Planning

**Date**: 2026-04-17 09:44
**Severity**: N/A
**Component**: llm-gateway ecosystem expansion
**Status**: Plan complete, phase 1 ready to execute

## What Happened

Completed brainstorm + planning for HTTP/WebSocket network layer on top of existing llm-gateway SDK. Produced brainstorm report and 8-phase implementation plan with 16h estimated effort.

## Architecture Decisions

**Monorepo structure** (pnpm workspaces over npm/Turborepo): simplicity wins for v1, easier dependency management.

**WebSocket transport**: raw `ws` library over Socket.IO — user explicitly wanted lightweight true WebSocket, not abstraction layer.

**Auth**: JWT in query string (`?token=JWT`) on WS upgrade, in-memory user seed from env, no database phase 1. Trade-off: query string can leak to reverse-proxy logs (acceptable, documented for phase 2 swap).

**HTTP server**: Express 4.x (stable ecosystem, not 5.x beta).

**Streaming**: token-by-token matching gateway.stream() API contract.

## Critical Constraints Accepted

- In-memory users reset on restart (v1 acceptable)
- Single-instance only (Redis deferred to phase 2)
- No chat persistence (llm-db empty until phase 2)
- JWT in query string logged by proxies (phase 2: first-message auth)

## Outputs

1. Brainstorm report: `plans/reports/brainstorm-260417-0944-llm-http-monorepo-websocket.md`
2. Plan directory: `plans/260417-0944-llm-http-monorepo-websocket/` (plan.md + 8 phase files)
3. 8 Claude tasks hydrated and queued

## Unresolved Questions

- Where to test llm-shared types? (integration point between packages)
- workspace:* protocol verification needed?
- CORS allowlist for production?
- Logger format standardization for prod?
