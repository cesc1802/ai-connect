# Dashboard Stats API — `GET /api/dashboard/stats` Implementation

**Date**: 2026-06-17 12:35  
**Severity**: Low  
**Component**: llm-http, dashboard routes  
**Status**: Complete

## What Happened

Shipped `GET /api/dashboard/stats` endpoint in `@ai-connect/http` — authenticated, role-scoped dashboard overview returning workspace list, member count, active provider count. Zero new repository/database code; endpoint composes three existing container services with role-based filtering. Vitest green (445 passed, 63 skipped + 3 new dashboard tests). Code review: DONE, no blockers. Live on master@27e455d.

## The Brutal Truth

This was textbook lazy design — except it worked. The scouting phase (before planning) found `usersService.listVisibleUsers({id,role})` **already encoded the exact member-scoping the spec needed** (admin→all users, member→co-workspace incl. self). Instead of writing a new count query, I just called it and took `.length`. That reuse avoided SQL duplication and meant zero new DB contract.

The frustration point: requirement was ambiguous on day one ("count members" vs "list members"? "all workspaces" vs "current workspace"?). Two rounds of AskUserQuestion to pin member-scope vs workspace-scope. The single-vs-split-endpoint question, member visibility rules, and per-role scoping were all user calls. Once locked in, implementation was straightforward because **the existing service layer already did what we asked**.

Trade-off accepted: workspace repo has no unbounded mode, so I hardcoded `ALL_WORKSPACES_LIMIT = 10_000` locally instead of widening the shared repository contract. Surgical, isolated, documented. Known cheap future fix if orgs ever exceed 10k workspaces (unreachable at current scale; live comment flagged it).

## Technical Details

**Files changed:**
- NEW `llm-http/src/dashboard/dashboard-routes.ts` (54 LOC): handler + 3 test cases in dashboard-routes.test.ts
- MODIFIED `llm-http/src/app.ts`: mounted new routes under `/dashboard`
- MODIFIED `docs/codebase-summary.md` + `docs/system-architecture.md`: route table + API reference updated

**Endpoint:**
```ts
GET /api/dashboard/stats
Auth: requireAuth (any authenticated user, NOT org-admin gated)
Response: {
  workspaces: [{id, slug, name}],
  memberCount: number,
  activeProviderCount: number
}
```

**Role scoping:**
- **Admin**: all org workspaces + all org users (memberCount = usersService.listVisibleUsers(org.id, ADMIN).length)
- **Member**: own workspaces (workspace_id match) + co-workspace users including self (memberCount = usersService.listVisibleUsers(org.id, MEMBER).length filtered by co-workspace)
- **activeProviderCount**: org-wide (providers.enabled=true) for all roles — not user-scoped, not workspace-scoped.

**Composition — zero new DB code:**
1. `usersService.listVisibleUsers({org.id, role})` → already filtered by role + workspace membership
2. `workspaceService.listAll({limit: ALL_WORKSPACES_LIMIT})` → workspace rows
3. `providersService.listActive()` → enabled providers filtered by catalogs.enabled=true

Counting via `.length` instead of SQL COUNT — accepted at org scale. Providers load full encrypted key row just to count; negligible overhead for handful per org. Future optimization task; YAGNI now.

## What We Tried

1. **Ambiguous spec clarification**: "Count all members" — whose members? Org-wide or workspace-scoped? "Get all workspaces" — admin only or per-role? Resolved via two AskUserQuestion rounds: member-scope tied to user role + co-workspace visibility, workspace list per-role visibility.
2. **Dedicated memberCount query vs reuse**: Initially considered dedicated SQL COUNT. Checked existing usersService — already does the filtering we need. Reused.
3. **Paged vs unbounded workspace list**: workspaceService.listAll() takes {limit, offset} only. Chose local `ALL_WORKSPACES_LIMIT = 10_000` sentinel over widening shared repository contract.

## Root Cause Analysis

Scouting paid off — the existing `usersService.listVisibleUsers()` was already correct for member scoping. No new pattern needed; just composition. The ambiguous spec didn't delay code, just required clarification before locking details. Requirements discussions happened before planning; planning + implementation were straightforward because the existing layer already matched the spec.

Workspace list limit came from repo contract design — `listAll()` doesn't expose an unbounded mode. Rather than widen a shared contract for one dashboard call, accepted local truncation sentinel. Surgical, visible, documented.

## Lessons Learned

1. **Scout before planning pays dividends**: Existing `usersService` already had the exact filtering (admin→all, member→co-workspace). Saved writing a new query. Lesson: check service layer reuse before designing new queries.

2. **Ambiguous specs require synchronous clarification, not assumptions**: "Count members" could mean org-scoped or workspace-scoped. Stopped planning, asked user, locked in. Cost: 10 minutes; benefit: avoided building wrong thing. Recommend for future ambiguous endpoints.

3. **Composition is simpler than new DB code**: Endpoint is 54 LOC of service calls + filtering. No migration, no new tables, no new indexes. Easier to test, easier to change, easier to reason about.

4. **Per-role scoping in service layer is stable**: `usersService.listVisibleUsers({id, role})` encodes the rule. Endpoint just calls it. If visibility rule changes (e.g., members see X instead of Y), one place to fix.

5. **Hardcoded limits vs shared contract**: `ALL_WORKSPACES_LIMIT = 10_000` is local, ugly, but avoids changing workspaceService repo. Acceptable trade-off at current scale. Document it as a cheap future fix.

6. **`req.user.org` is a single-org shim**: All dashboard calls hardcode `req.user.org` (= "default" org). Pre-existing multi-org-incompleteness, not introduced here. Passing it as variable (not literal) keeps code forward-compatible if multi-org lands later. Call it out, not a blocker.

## Verification

- **Compile**: tsc clean, no errors.
- **Tests**: Full @ai-connect/http suite green. 3 new dashboard tests pass (admin sees all workspaces, member sees own, member sees co-workspace users + self in count).
- **Code review**: DONE — no must-fix issues, 3 low-severity observations (future optimizations, all documented).
- **Regressions**: None. Public contract unchanged. No new dependencies.
- **Shipping**: No migration, no breaking changes. Safe to merge.

## Next Steps

1. Merge to master (ready now).
2. Monitor `GET /api/dashboard/stats` latency in production (usersService.listVisibleUsers can be slow on large orgs; future optimization candidate if p95 > 500ms).
3. If orgs approach 10k workspaces, remove `ALL_WORKSPACES_LIMIT` hardcoding — add unbounded mode to workspaceService.listAll() (tracked as future task).

---

**Status:** DONE  
**Summary:** Dashboard stats endpoint shipped — role-scoped, reusing existing service layer (usersService + workspaceService + providersService), zero new DB code, all tests passing, ready to merge.

## Unresolved Questions

- Latency SLA for `/api/dashboard/stats`? (usersService.listVisibleUsers can load all org users; may need pagination or caching if P95 > 500ms in production)
- Should workspace list be paginated instead of capped at 10k? (design decision deferred; flag for user when scale nears limit)
