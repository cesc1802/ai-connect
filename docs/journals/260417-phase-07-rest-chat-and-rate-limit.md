# Phase 7: REST /chat Endpoint & Rate Limiting Complete

**Date**: 2026-04-17 15:00
**Severity**: Medium (production-critical feature)
**Component**: llm-http REST API, rate limiting layer
**Status**: Resolved

## What Happened

Shipped Phase 7 with REST `/chat` endpoint and rate limiting. Added 3 new files (rate-limit.ts, one-shot-chat-use-case.ts, chat-rest-routes.ts), modified 3 core files (config.ts, container.ts, app.ts). 343 tests passing (96 new).

## The Brutal Truth

Code review score was 7.5/10 initially — not ideal for production. The trust proxy oversight was a painful catch: without it, rate limiting IP keys fail silently behind reverse proxies. That's exactly the kind of bug that haunts deployments. Also, REST schema was missing "tool" role that WebSocket had, breaking contract consistency.

## Technical Details

**Rate Limiting Strategy**: ip-based for login (5/15min), user-based for chat (60/hour). Using express-rate-limit@^7 with draft-7 headers.

**REST/WS Code Reuse**: POST /chat and WebSocket handler share ChatGatewayPort via dependency injection. Zero duplication, clean separation of concerns.

**Trust Proxy Fix**: Added `app.set('trust proxy', true)` for production environments where X-Forwarded-For headers are present. Without this, all requests appear from proxy IP, rate limiting becomes useless.

## What We Tried

Initial implementation skipped trust proxy—assumed direct socket connection. Code review flagged it. Fixed immediately. REST schema had only ["user", "assistant", "system"] roles—added "tool" to match WebSocket implementation.

## Root Cause Analysis

Trust proxy assumption was careless. We have Nginx reverse proxy in architecture docs but didn't verify config against deployment topology. REST schema inconsistency was worse: copy-paste from WS without auditing field completeness.

## Lessons Learned

- Always validate assumptions against production topology before shipping
- Schema contracts must be audited for feature parity across transports
- Rate limiting is silent—missing trust proxy means zero IP-based protection, which is undetectable without explicit testing
- DRY principle paid off: reusing ChatGatewayPort eliminated duplicate logic and made the missing trust proxy visible earlier

## Next Steps

Phase 8 (Resilience Patterns) starts now. Trust proxy configuration is locked and tested. Rate limiting now production-ready with 343 passing tests validating both IP and user-based constraints.
