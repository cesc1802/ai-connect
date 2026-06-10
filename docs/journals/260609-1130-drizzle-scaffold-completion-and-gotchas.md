# Drizzle ORM Scaffold Complete: NodeNext Incompatibility, Auth Reshape, and CI Gotchas

**Date**: 2026-06-09 11:30
**Severity**: Medium
**Component**: llm-db (Drizzle 0.36 + drizzle-kit 0.30), llm-http (Postgres integration)
**Status**: Resolved

## What Happened

Completed all 7 phases of the llm-db Drizzle scaffold plan. Wired Drizzle + Postgres persistence into llm-http's existing repository interfaces via env-gated composition root (PERSISTENCE=in-memory|drizzle). All tests pass (llm-ui 31, llm-gateway 308, llm-http 372+1 skipped). Commit: d41293f.

## The Brutal Truth

Drizzle + TypeScript module resolution is a landmine. Lost ~3 hours to drizzle-kit's loader choking on `.js` specifiers in source code. Auth system got reshaped mid-plan (user-confirmed) to strip JWT to 4 claims and add a system `role` column — a reversible but non-trivial addition to user schema. CI hung on watch-mode test runner. Git commit tooling almost shipped broken code (old tests with new source). Every "simple" phase had at least one gotcha that required defensive decisions, not just following the happy path.

## Technical Details

### 1. NodeNext + drizzle-kit MODULE_NOT_FOUND

**Error**: `Cannot find module /src/schema/_audit-columns.js` when running `drizzle-kit generate`

**Root cause**: Repository uses `.js` import specifiers per convention (`import { ... } from './_audit-columns.js'`). drizzle-kit's module loader cannot resolve `.js` → `.ts` on the fly. The `drizzle.config.ts` pointed schema at `./src/schema/index.ts` (source, not compiled).

**Fix applied**: Build TypeScript first, then generate:
```bash
"db:generate": "tsc && drizzle-kit generate --config drizzle.config.ts"
```

Drizzle.config now points schema at compiled `./dist/schema/index.js`. Upside: drizzle-kit sees compiled output. Downside: must compile before every `generate` call. Trade-off accepted because `generate` is run once per migration, not constantly.

**Lesson**: drizzle-kit ≠ TypeScript-aware. Treat it as compiled-output-only. Document the build-first requirement or face MODULE_NOT_FOUND on every schema change.

### 2. Auth Reshape: System Role + JWT Claims Reduction (User-Confirmed)

**Decision**: JWT stripped to {sub, username, iat, exp} only; workspace resolution moved to a separate API call. Added a NEW `role` column to users table (admin | member), independent of per-workspace roles.

**Schema impact**: Migration 0001_add_user_system_role.sql added:
- `system_role` enum (admin, member)
- `users.system_role` column (NOT NULL, DEFAULT 'member')

**Transition shim**: Auth middleware maps system_role → legacy workspaceRole field (admin → workspaceRole='admin') so admin-only routes continue working pending decommission. Reversible: can strip the shim once routes are updated.

**Lesson**: System vs workspace scope was semantically conflated. Splitting them required a migration + transitional code, but it clarifies the permission boundary: system admins ≠ workspace admins. Document the decommission path so the shim doesn't fossilize.

### 3. Drizzle Test Isolation: Shared DEV_USER_ID → FK Violations

**Error**: Parallel test files all seeded the same DEV_USER_ID; afterEach deleted it; tests ran out of order → FK constraint violations.

**Fix**: seed-test-identity.ts helper now seeds a unique workspace + user + membership per test file with distinct UUIDs (based on test filename hash). Isolation guaranteed, no test flakes due to ordering.

**Lesson**: Parallel test runners + shared seed data = race condition. Per-test identity isolation is non-negotiable for stateful tests.

### 4. CI Hang Blocker: `vitest` in Watch Mode

**Error**: `pnpm -r test` hung indefinitely; SIGTERM didn't kill the process. Full CI would deadlock.

**Root cause**: llm-http package.json had `"test": "vitest"` (watch mode, never exits). CI runner hit 10m timeout waiting for exit.

**Fix**: Changed to `"vitest run"` (exit after run). Full test suite now completes cleanly (EXIT:0).

**Lesson**: Never ship watch-mode test runners in CI. Verify all npm scripts terminate, not just succeed. Caught by manual test run after commit.

### 5. Migration Filename De-Referencing

**Before**: 0000_phase02_init.sql, 0001_boring_ultimatum.sql (referenced plan phases)

**After**: 0000_initial_schema.sql, 0001_add_user_system_role.sql (domain-only, no plan artifacts)

**Impact**: Per CLAUDE.md rules, filenames must not reference plan artifacts. Drizzle uses filename-based tracking (_journal.json stores hash), so renaming is idempotent — migration still runs only once. Verified after rename that hash-based tracking held.

**Lesson**: Plan artifacts are temporal; domain names are permanent. Rename early.

### 6. CI Workflow Created

Added `.github/workflows/ci.yml`: postgres:16-alpine service container, drizzle-kit check (detect schema drift), db:migrate, build, test with PERSISTENCE=drizzle. All steps gated on the previous step's exit code.

### 7. Git Commit Scoping Gotcha: Excluded Tests vs Source

**What happened**: git-manager initially excluded 8 llm-http test files that were actually plan work (`req.user.role` property, conversation create gained `workspaceId`). Would have produced a broken commit (new source that source code depends on, old tests).

**Caught by**: Post-commit review of git status. Tests didn't match source assumptions.

**Fix**: Amended commit to include the excluded test files.

**Lesson**: Verify committed tree is self-consistent, not just that excluded files "look unrelated." If tests reference new properties or new required parameters, they are part of the change, not optional. This one was subtle because tests didn't fail immediately — they would fail when run against the new code.

## What We Tried

1. Pointed drizzle.config at source TS → drizzle-kit threw MODULE_NOT_FOUND. Tried ESM loader hooks, gave up, added `tsc` to script.
2. Used shared DEV_USER_ID fixture → flaky tests. Switched to per-test-file identity seeding.
3. Ran `pnpm test` in CI → hung. Changed to `vitest run`.
4. Tried keeping plan-artifact filenames in migrations → violated rules. Renamed and verified idempotency.
5. Almost shipped commit without test file inclusions → added last-minute amendment.

## Root Cause Analysis

**NodeNext incompatibility**: Drizzle assumes a build-first pipeline, but the repository's source-level `.js` specifiers confused its module loader. Documentation doesn't warn about this. Should have started with a spike on drizzle-kit's loader assumptions.

**Auth reshape mid-plan**: User-confirmed, but it added complexity (new migration, new enum, shim code) that wasn't fully scoped upfront. Added 1–2 days. Lesson: shape-changing decisions need explicit time budget.

**Test isolation race**: Assumed test isolation was built-in; it wasn't. Caught during parallel runs, not in developer workflows. Should have run tests with `--reporter=verbose` and `-w 4` early.

**CI watch-mode hang**: npm script conventions vary; watch-mode is the default for dev, never for CI. Should have audited all package.json scripts against "will this exit cleanly in CI?"

**Commit scoping miss**: Tooling can't know if excluded files are "optional improvements" or "part of the change set." Manual review after commit prevented a broken merge.

## Lessons Learned

1. **Drizzle + TypeScript**: Always compile source before running drizzle-kit. Document this in `db:generate` scripts. Consider a pre-generate type check.

2. **Auth boundaries are slippery**: System role vs workspace role is a cleaner split, but the transition code must be explicitly reversible. Annotate shim code with the decommission plan (which routes need updating, timeline).

3. **Parallel test runners need per-test seeds**: Don't share fixtures across test files. Use a deterministic (e.g., filename-based) seed so a test is reproducible regardless of run order.

4. **npm scripts in CI must exit**: Audit package.json for watch-mode or interactive runners. Verify `pnpm -r test` returns EXIT:0 before committing.

5. **Commit validation is not just "code compiles"**: Verify the committed tree's test + source alignment. Run tests against the commit, not just the working tree. A broken commit can pass linting and still fail on apply.

## Next Steps

1. **Monitor the shim code** (`auth-middleware.ts`): Document which routes depend on workspaceRole mapping. Remove the shim once those routes are updated to use the system-level API.

2. **Consider a pre-generate check** in drizzle-kit: Verify schema source builds before invoking drizzle-kit. Could be a GitHub action step or local pre-commit hook.

3. **Audit remaining in-memory repos** (providers, templates, quotas, audit) and prioritize next phase. These are out of scope for this plan, but they're known candidates.

4. **Production PG host decision** before first production deploy. Neon/Supabase/RDS all work with the same schema; connection string only. Revisit the open question in the plan.

5. **Consider a "migrations runbook"** in docs/database-migrations.md once the foundation is stable. How to write a safe migration, how to test locally, how to verify in CI.

---

**Files saved to**: `/Users/thuocnguyen/Documents/personal-workspace/ai-connect/docs/journals/260609-1130-drizzle-scaffold-completion-and-gotchas.md`
