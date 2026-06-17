# Token Usage Capture Per Provider & Workspace

**Date**: 2026-06-17 15:15
**Severity**: Medium
**Component**: Metrics, Gateway, Chat, API, Dashboard UI
**Status**: Complete

## What Happened

Implemented end-to-end token usage tracking across 7 phases via `/ck:cook`. Feature captures chat token consumption per provider, workspace, and conversation, writes single metrics row per turn, exposes via dashboard API with role-scoped filtering (admin=org-wide, member=own workspaces).

## Technical Implementation

### Database
- Migration `0007_usage_metrics_provider_nullable.sql`: Made `usage_metrics.provider_id` nullable + added FK `ON DELETE SET NULL`. Rationale: provider deletion must not cascade-block usage history; rows retain `providerKind+model` for attribution fallback.

### Gateway Attribution
- Stamped resolved provider kind onto terminal `StreamChunk` only (gateway.ts). New optional `StreamChunk.provider` field. Authoritative source — not parsing model-string prefixes downstream.

### Event Flow & Capture
- Single capture point via event bus (attachUsageRecorder consumer, usage-recorder.ts). Pending-map pattern: capture `{userId, conversationId, model}` keyed by `requestId` at `chat.requested`; join on `stream.completed`. Writes exactly one `usage_metrics` row per turn.
- Error isolation: try/catch wraps metrics writes so failures never break chat stream.
- Cleanup: `stream.failed` and `stream.aborted` drop pending entry.

### Provider Attribution Fallback Chain
1. Gateway-resolved provider (authoritative)
2. Model-prefix parsing (kind::model or kind/model syntax)
3. "unknown" (providerId=null)

Fallback uses `active-provider-resolver`: newest ENABLED provider per kind (ordered `updatedAt desc, id asc`), mirroring gateway `DbProviderConfigSource` winner.

### API & Authorization
- `GET /api/dashboard/usage`: requireAuth, role-scoped.
  - Admin: org-wide view.
  - Member: filtered to own workspace set only.
  - Both scopes apply to byProvider AND byWorkspace aggregations; empty member set → empty arrays.
  - Mirrors dashboard-routes role-scoping pattern.

### UI
- `overview-screen` fetches via `usage-api.getUsage()`.
- New `usage-summary.tsx` widget: Vietnamese labels, K/M formatting, loading/empty states.

## Key Decisions

**Single Capture Point**: Event bus consumer pattern avoids duplication and N call-site maintenance. Metrics are fire-and-forget; stream continuity guaranteed.

**Per-Turn Rows, Aggregate-on-Read**: Immutable metrics row per turn. Aggregation (group by provider/workspace) computed on read. UsageScope filter chain: "all" → no WHERE, empty array → `sql\`false\``, explicit list → `inArray()`.

**Parallel Test Safety**: DB-gated tests use unique provider kinds per suite to prevent cross-worker races under parallel vitest. Each test class owns its provider namespace.

**Migration Naming**: File generated as ALTER (table pre-existed in migration 0000), not CREATE. Renamed to domain-slug pattern per naming rule and tagged in journal.

## Results

- **Feature tests**: 53/53 pass (including 10 live-Postgres DB-gated).
- **Full suite**: 961 pass + 1 pre-existing unrelated Ollama e2e timeout (flaky, not this feature).
- **Build**: typecheck + build clean across all 5 packages.
- **Code review**: production-ready, no blockers.

## Lessons Learned

1. **Event bus > imperative**: Avoids tight coupling and hidden call sites. Future metrics consumers plug in without touching chat handler.
2. **Resolve early**: Attribution at gateway, not downstream. Model-string parsing is fragile; single source of truth beats fallback chains.
3. **Test isolation for parallel workers**: Shared test fixtures (database state) need per-worker namespacing or unique identifiers. Learned this the hard way with timeouts on concurrent inserts.

## Next Steps

None — feature complete and merged. Monitor for metrics data quality in staging before production rollout.
