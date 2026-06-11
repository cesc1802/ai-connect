# Lazy-Load DB Providers into Gateway Engine — Design Brainstorm

**Date**: 2026-06-11 12:29  
**Severity**: High  
**Component**: llm-gateway, llm-http, llm-db  
**Status**: Design Complete

## What Happened

Designed zero-restart provider config refresh: shift from env-var static config in llm-http (`container.ts:113-128`) to DB-backed dynamic loading (`provider_catalogs`, `providers`, `workspace_providers` in llm-db). Gateway currently rebuilds eagerly at startup; changes require restart. Brainstorm locked design for TTL-cached refresh-on-use (Approach A of 3), decided interface shape (ProviderConfigSource), deferred dispose strategy (graceful swap + grace period to preserve in-flight streams), and reversed an initial schema direction mid-session.

## The Brutal Truth

This was a **clean brainstorm with one painful course-correction**: user initially wanted env-var indirection as the key-fetch mechanism, but scout discovered `ApiKeyVault` (AES-256-GCM) already existed and admin API already encrypts on save. We could use it directly instead of duplicating key logic. Felt like backtracking, but the right call — reuse beats reinvention. The frustration was that 15 minutes of design assumed a pattern that turned out unnecessary; but catching it before coding saved rework.

The other win: rejecting per-provider lazy `resolve()` upfront. Router needs full candidate list anyway (to route incoming requests), so lazy-per-name doesn't save queries — just adds machinery. Felt overengineered even on paper.

## Technical Details

**Problem statement:**
- Providers live in DB (`provider_catalogs`, `providers`, `workspace_providers` tables).
- Admin API can create/edit via `providers-service.ts`, encrypts keys via `ApiKeyVault`.
- But gateway still reads static `ProviderConfig` from env vars in `llm-http/container.ts`.
- DB changes never reach running engine without restart.

**Approach A (chosen):**
- Inject `ProviderConfigSource` interface into gateway:
  ```ts
  export interface ProviderConfigSource {
    load(): Promise<ProviderConfig>;
  }
  ```
- TTL refresh-on-use (~60s): at top of `chat()`/`stream()`, if cache age ≥ TTL, call `source.load()`, diff per-provider config (stable stringify) vs running set.
- Unchanged providers keep circuit-breaker state + metrics.
- Changed/removed: swap new instance into router, **defer old dispose by `streamIdleTimeoutMs`** (grace period for in-flight holders to finish on old instance).
- Single deduped refresh promise (concurrent requests share one DB query).
- Failure after first load: keep last good config, log stale. Failure on first: fail request.
- Gateway tolerates empty provider set at boot (providers appear later via DB).

**llm-http implementation:**
- New `db-provider-config-source.ts`: Drizzle query (enabled=true providers join catalogs) → decrypt `encryptedKey` via existing `ApiKeyVault` → map to ProviderConfig shape.
- `container.ts`: remove `extractProviderConfigs` env path; pass `{ source, refreshTtlMs: 60_000 }` to gateway.
- Boot error "at least one provider required in production" downgrade to warning (providers can appear post-boot).
- **Env-var provider config removed entirely** — DB single source of truth.

**Constraints:**
- `ProviderName` hardcoded union (anthropic|openai|ollama|minimax); one enabled instance per catalog type. Multi-instance routing future work.
- Workspace `enabled` bindings UI-only this round (org-global resolution only).
- Push invalidation out of scope; TTL only.

## What We Tried

1. **Env-var key indirection**: Assumed we'd proxy key-fetch through env vars. Rejected after scout found vault + admin API already handling encryption. Reversed to reuse vault directly.
2. **Per-provider lazy `resolve()`**: Sounded efficient. Rejected: router needs full list anyway; per-name TTLs = machinery for overhead.
3. **Whole gateway rebuild in llm-http on TTL**: Rejected: loses circuit-breaker state/metrics per refresh; dispose races with in-flight streams.

## Root Cause Analysis

Initial env-var indirection came from assumption that we should minimize vault dependencies in config layer. But scout found vault already a core dependency (admin API uses it). Cost of not reusing: duplicate key logic + another secret to manage. Lesson: always check what exists before assuming you need new infra.

Per-provider lazy resolve seemed like elegant caching until we traced back to actual usage: router needs full candidate list to route each request. Lazy-per-name buys nothing; adds complexity.

## Lessons Learned

1. **Scout before designing abstractions**: Assumed vault indirection was new work; it wasn't. Five-minute code review of existing vault + admin API would have saved 15 minutes of design. Scout first, design after.

2. **Full dependency graph matters for caching**: Per-provider lazy sounds good until you realize the caller needs all providers anyway. Always trace from request path → config fetch → what data you actually use.

3. **Deferred dispose requires careful boundary thinking**: Swapping circuit-breaker instances preserves state. But old instance lives until grace timer expires (streamIdleTimeoutMs). Under rapid edits, this could accumulate disposed instances. Bounded by grace timer, negligible at admin-edit frequency. Document this trade-off.

4. **TTL cache + stale-fallback is resilient**: Failure after first load keeps last good config. Means one DB outage post-startup doesn't kill the service. Acceptable degradation.

5. **One instance per catalog type is a constraint, not a bug**: Hardcoded ProviderName union + instance registry means we can't route to multiple enabled anthropic configs. Future multi-instance routing is separate work. Call it out clearly in constraints.

## Next Steps

1. **Implementation plan pending**: User ended session without creating formal plan. When implementation starts, use `/ck:plan --tdd` (modifies core request path; existing test suite must be preserved).
2. **Config TTL value**: Default 60s assumed. Should it be configurable via env var? (bikeshed for later; 60s sensible).
3. **Metrics API**: Should `getMetrics()` expose last-refresh timestamp or source errors? (nice-to-have; not blocking).

---

**Status:** DONE  
**Summary:** Lazy-load DB provider config design finalized: ProviderConfigSource interface + TTL refresh-on-use, deferred dispose grace period preserves in-flight streams, env-var config removed from llm-http, existing ApiKeyVault reused (reversed initial env-var indirection). Implementation plan deferred to `/ck:plan --tdd` when coding starts.

## Unresolved Questions

- TTL value configurable or hardcoded 60s?
- Soft-vs-hard delete for providers (product scoping)?
- Metrics API exposure for refresh state?
