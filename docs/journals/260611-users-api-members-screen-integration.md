# Users API (Role-Scoped) + Members Screen Integration

**Date**: 2026-06-11 10:00  
**Severity**: Medium  
**Component**: llm-http, llm-ui, llm-db  
**Status**: Resolved

## What Happened

Shipped GET /users endpoint with role-based scoping + Members ("Thành viên") screen rewrite. Backend: 3-layer module (users-repo.ts, users-service.ts, users-routes.ts) wired into container and app. Admin sees all users; members see users sharing ≥1 workspace via `user_workspaces` join (union across caller's workspaces), caller always included even with 0 memberships. Frontend: new llm-ui/src/lib/users-api.ts, members-screen.tsx rewritten with LoadState + monotonic loadSeq race guard + hashHue for deterministic avatar colors. Verification: llm-http 466 tests pass, users module 8/8 against real Postgres, llm-ui build + 66 tests green. Commit post-shipment.

## The Brutal Truth

**This hurt because we shipped half-thought-out scoping that exposed a gap in our mental model.**

The scout report said membership table was `user_role_workspaces` (which is role assignment, not membership). Planner assumed that was the join source and didn't verify. Three hours wasted digging through code until we found the actual membership source: `user_workspaces` table (which drizzle-workspace-members-repository already uses at line 33). The scoping logic was correct once we used the right table, but the misdirection cost time and left us feeling sloppy.

Second: the business decision to show only `{id, username, role}` with zero context (no memberships in response, no email, no lastActive, no Workspaces column) felt like we were shipping an incomplete UI to avoid the complexity of a cross-workspace membership join. It works, but users can't see *which* workspaces they share with a member—invite button is a non-functional placeholder. We documented it as scope containment, but the placeholder button is friction.

Third: code review flagged Avatar component getting `{name, hue}` cast from `User` (which has no hue field). The cast works at runtime, but it's fragile—if User schema changes, the cast silently breaks.

## Technical Details

**Database layer (llm-db):**
- No migration needed. Uses existing `user_workspaces` table (columns: id, user_id, workspace_id, created_at).
- Pre-existing cascade-delete test in drizzle-workspace-members-repository.test.ts fails on clean tree when DATABASE_URL is set (not caused by this work; noted as known failure).

**HTTP API (llm-http):**
- New module at llm-http/src/users/:
  - **users-repo.ts**: UsersRepository interface + DrizzleUsersRepository implementation (fetches user by id, lists by ids). Test double: InMemoryUsersRepository.
  - **users-service.ts**: DefaultUsersService wraps repo, applies role-based scoping filter.
  - **users-routes.ts**: GET /users, requireAuth middleware, calls service with caller context.
- Scoping logic:
  - **Admin**: returns all users (no filter).
  - **Member**: returns users sharing ≥1 workspace with caller (union via `user_workspaces` table). Caller always included via separate fetch and unshift (even if caller has 0 workspace memberships, own row returned separately).
- Response shape: `{id, username, role}`. No memberships array in response; no email/status/lastActive (not persisted in DB).
- Wired in container.ts (usersRepository, usersService); mounted at /users in app.ts with requireAuth.
- Test coverage: 8 tests in users module, all pass against real Postgres (Docker). 466 total llm-http tests pass.

**UI layer (llm-ui):**
- New llm-ui/src/lib/users-api.ts: Typed fetchWorkspaceUsers(workspaceId) → User[].
- members-screen.tsx rewritten:
  - LoadState (loading | error | ready) pattern; monotonic loadSeq race guard (increment counter on each fetch, ignore stale responses).
  - hashHue(userId) for deterministic Avatar color (no server round-trip, no color stored in DB).
  - Cast `{name, hue}` as User for Avatar—cheap but fragile.
  - Search/filter client-side (no server pagination).
  - Invite button: non-functional placeholder.
- Test coverage: 66 llm-ui tests, all green. Build passes tsc.

## What We Tried

1. **Scout's `user_role_workspaces` assumption**: Trusted scout report without verification. Caused 3-hour rabbit hole. Switched to reading drizzle-workspace-members-repository.ts:33 to confirm actual membership source (`user_workspaces`). Lesson: verify data-layer naming in live code, especially for cross-table joins.

2. **Includng memberships array in user response**: Considered adding `memberships: [{workspaceId, role}]` to response. Deferred to keep Phase 1 scope tight (no cross-workspace membership join). Noted as debt.

3. **Role-aware Avatar without fragile cast**: Considered moving hue into User schema. Kept hashHue client-side to avoid schema bloat. Cast remains fragile; documented as code review nit.

## Root Cause Analysis

**Why scoping took so long:**
- Scout reported the table name from memory/grep, not source-verified. Planner didn't double-check the name in live code.
- Team assumed scout report was canonical without verification—cost us debugging time.
- Lesson: for cross-system queries (DB joins), always verify table/column names in live schema (Drizzle schema or DB directly), not scout reports alone.

**Why response shape is thin:**
- Product scope: Phase 1 is "list users in workspace" with invite placeholder. Memberships join is Phase 2 complexity.
- Trade-off accepted: thin response avoids N+1 and complex joins now; UI friction (can't see shared workspaces) deferred.

**Why Avatar cast is fragile:**
- Runtime-safe (hue computed client-side, Avatar doesn't require it in type definition).
- But type-unsafe: User type doesn't declare hue, so TypeScript allows the cast but doesn't enforce schema alignment.
- Not a blocker; caught by code review as "minor + nit". Acceptable for Phase 1.

## Lessons Learned

1. **Verify data-layer names in live code, not memory**: Scout's grep is a starting point. For any cross-table join, read the actual schema (Drizzle schema file or DB introspect). Don't trust report names; source-verify.

2. **Scoping clarity prevents 3-hour distractions**: Define which table/columns you're joining on *before* implementation. A 5-minute schema review beats a 3-hour debug session.

3. **Fragile casts are acceptable Phase 1 debt if documented**: Avatar cast works at runtime, fails at type-check. Acceptable for Phase 1 scope; mark as debt ("Avatar type-casting fragility — refactor when User schema stabilizes").

4. **Placeholder buttons should have intent description**: Invite button is non-functional. Add a title attribute or disabled state with tooltip explaining "Phase 2 feature". Prevents users wondering why it's dead.

5. **Monotonic loadSeq guards race conditions in LoadState patterns**: Using a counter that increments on each fetch and ignoring responses with old sequence numbers is a simple, reliable pattern for preventing stale state updates in React. Worth standardizing across screens.

## Next Steps

1. **Remove scoping ambiguity**: Add comment in users-service.ts explaining `user_workspaces` is the single source of truth for membership (not `user_role_workspaces`).

2. **Product: Invite placeholder intent**: Does Phase 2 include bulk-invite, email-invite, or role assignment? Define scope so UI can surface intent (e.g., "Invite (Phase 2)" or tooltip).

3. **Future: Add index on `user_workspaces.workspace_id`**: Code review noted no index. Query scans full table per workspace. Add after profiling (not blocking for small deployments).

4. **Future: Pagination for large workspaces**: Current response has no limit. For workspaces with 1000+ members, implement server-side pagination.

5. **Future: Avatar type safety**: Refactor Avatar to accept `User` directly or move hue into User schema (after User schema stabilizes). Remove runtime cast.

---

**Status:** DONE  
**Summary:** Users API (role-scoped: admin→all, member→workspace co-members) + Members screen rewrite shipped. Backend: 3-layer module (repo/service/routes), scoping via `user_workspaces` join. Frontend: LoadState + hashHue avatar + client-side search. Scout report misdirection (user_role_workspaces vs user_workspaces) cost 3 hours; verified at drizzle-workspace-members-repository.ts:33. llm-http 466/466 tests pass, users module 8/8 Postgres tests, llm-ui 66/66 tests green. Pre-merge code review: 0 critical/major, 4 minor + 4 nits (Avatar cast fragility, no workspace context, no pagination, no user_workspaces index). Known failure (unrelated): drizzle-workspace-members-repository cascade-delete test fails on clean tree. `/Users/thuocnguyen/Documents/personal-workspace/ai-connect/docs/journals/260611-users-api-members-screen-integration.md`

## Unresolved Questions

- Should Avatar cast be refactored to full User type, or is Phase 1 fragility acceptable? (code debt—no blocker)
- Does Phase 2 invite include bulk-invite, email-invite, or role reassignment? (product scope)
- At what member count does pagination become critical? (performance validation)
