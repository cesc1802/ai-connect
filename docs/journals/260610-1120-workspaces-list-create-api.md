# Workspaces List/Create API: Role-Aware Bifurcation, Slug Collision Handling, and Safe Pagination

**Date**: 2026-06-10 11:20
**Severity**: Low
**Component**: llm-http workspace routes + drizzle repository
**Status**: Resolved

## What Happened

Completed workspaces list/create API endpoints (GET/POST /workspaces). Role-aware bifurcation: admins list all non-deleted workspaces; members list only their own memberships via user_workspaces join. Slug auto-derivation from name (lowercase, hyphens, 50-char limit). Drizzle repository unconditional at boot (DATABASE_URL required). Full test suite: 24 unit tests + 6 integration tests. Commit: 8e64bbc.

## The Brutal Truth

The API is simple, but the simplicity hides three subtle decisions that almost broke: (1) Slug derivation was initially capped at 100 chars (violating the schema's 50-char limit). (2) Pagination was nondeterministic when createdAt had ties. (3) POST /workspaces needs inline role guard (not middleware) because GET on same path is member-accessible — path-level middleware would choke both. Code review caught (1) and (2); both required regression tests. Decision to NOT auto-add creator as member was user-approved but unintuitive — could confuse future users. The frustration: these are the kind of quiet bugs that ship and surface in production.

## Technical Details

### 1. Slug Derivation: Truncation Violation

**Problem**: slugify() derived from 100-char name, then sliced at 50, but failed to trim trailing hyphens.
```typescript
.slice(0, 50)  // "very-long-name-with-trailing-hyphen----" → "very-long-name-with-trailing-hyphen----" (FAIL)
```

**Fix applied**: Added hyphen trim after slice:
```typescript
.slice(0, 50)
.replace(/-+$/, "");  // Now: "very-long-name-with-trailing"
```

**Regression test**: name "x".repeat(100) → slug exactly 50 chars, no trailing hyphens, matches schema constraint.

**Lesson**: Derived values must pass ALL constraints, not just the parent constraint. A 100-char name → 50-char slug is a new transformation boundary; test it explicitly.

### 2. Pagination Nondeterminism: Ties on createdAt

**Problem**: listAll() and listForUser() ordered by createdAt only. Two workspaces created within the same millisecond would return in database insertion order, not deterministic order.

**Fix applied**: Added secondary sort by id:
```typescript
.orderBy(asc(workspaces.createdAt), asc(workspaces.id))
```

**Impact**: Pagination now stable across runs. Page N always returns the same N workspaces regardless of query order or insertion sequence.

**Lesson**: Database sort order is not deterministic unless you include a unique column. Always pair timestamps with a tie-breaker (id, uuid, or sequence number).

### 3. Inline Route Guard for Role-Aware Bifurcation

**Decision**: POST /workspaces uses inline role check (`if (req.user.role !== "admin")`), not middleware, because GET on same path is member-accessible.

**Why not middleware?**: Path-level middleware on POST /workspaces would require additional route setup or conditional logic. GET /workspaces must NOT require admin role (members list their own workspaces). Route-level check keeps both endpoints on the same path without entanglement.

**Lesson**: Route bifurcation (different behavior per role, same path) requires inline guards, not middleware. Middleware assumes homogeneous role rules across a path.

### 4. Creator NOT Auto-Added as Member

**Decision**: repo.create() only inserts the workspace row, does NOT create a userWorkspaces entry for the creator. User explicitly rejected auto-membership because (a) workspace members can be different from workspace creator, (b) preserves explicit join semantics.

**Impact**: Admin can create workspace, then separately add members (including self) via a future membership API.

**Lesson**: "Obvious" side effects (creator → member) are not obvious. User decision is explicit and documented; don't guess.

## What We Tried

1. Slug truncated at 100 (name max) → schema expects 50. Tests passed because slugs weren't pushed near limit. Code review caught it.
2. Ordered by createdAt only → flaky pagination on ties. Caught by review; added id secondary sort.
3. Tried middleware guard for POST → awkward with GET on same path. Switched to inline guard.

## Root Cause Analysis

**Slug truncation**: Assumed name max (100) would carry over to slug. Didn't trace the transformation boundary (100 → 50). Schema constraint was available but not checked during implementation.

**Pagination**: Assumed SQL ORDER BY createdAt was deterministic. It's not — database can return ties in any order. Should have included tie-breaker from the start (it's a well-known pagination pattern).

**Guard location**: Conflated "admin endpoints" with "middleware applies to path." Route bifurcation is a different pattern and needs inline checks.

## Lessons Learned

1. **Derived values need their own boundary tests**: A value derived from another must pass the schema's own constraints, not just the source's. Test the transformation, not just the source.

2. **Sort by unique column for pagination stability**: Always include a unique (or near-unique) column as a tie-breaker. `ORDER BY createdAt, id` is a pattern, not a suggestion.

3. **Route bifurcation ≠ middleware**: When the same endpoint has role-based behavior (GET lists all for admin, own for member), inline role checks per handler are cleaner than conditional middleware. Middleware is for cross-cutting concerns (auth, logging), not branching logic.

4. **User decisions on side effects are binding**: If the user says "don't auto-add creator as member," don't guess. Document it and move on. Someone will ask "why isn't the creator a member?" and the answer is "we checked with the user."

## Next Steps

1. **Monitor slug collisions in production**: Track 409 slug_taken errors to see if collisions happen often. If they do, consider slug versioning (workspace, workspace-2, etc.).

2. **Add membership API**: Creator is not auto-added. Implement POST /workspaces/:id/members (or PATCH /workspaces/:id to accept members list). User decision is clear, but the UX path is incomplete.

3. **Soft-delete membership consideration**: listForUser() doesn't filter deletedAt on user_workspaces. Consistent with current resolver, but worth revisiting once soft-delete semantics are clearer. Document the decision.

4. **API docs**: api_docs.md generated (823 lines). Verify examples work end-to-end (happy path + 409 slug collision).

---

**Status:** DONE
**Summary:** Workspace list/create endpoints complete with role-aware bifurcation, slug collision handling, and stable pagination. Two code-review fixes applied (slug truncation, pagination order). No blocking issues.
