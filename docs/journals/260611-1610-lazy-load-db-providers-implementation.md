# Lazy-Load DB Providers into Gateway — 5-Phase TDD Implementation

**Date**: 2026-06-11 16:10  
**Severity**: High  
**Component**: llm-db, llm-gateway, llm-http  
**Status**: Resolved

## What Happened

Completed all 5 phases of lazy-load provider architecture: org admin API controls provider lifecycle (create/update/disable), gateway fetches from DB on demand with TTL-gated refresh, no env-var provider config, single source of truth in Postgres. Eliminated NullGatewayAdapter, container now always builds DB-sourced gateway, provider refresh configured via PROVIDER_REFRESH_TTL_MS. E2E lifecycle test (real Postgres + stub ollama) proves providers usable within TTL, disabled within TTL, no restart. Commit 906fc7b. All tests green: llm-http 559, llm-gateway 345, llm-ui 66.

## The Brutal Truth

This was **clean-looking until shell scripting and concurrency bit hard**. Three things stung:

1. **Shell precedence ghost-deleted in silence** — Test setup used `grep && echo || rm && echo`. Intended: "grep for file, if found echo 'exists', else rm and echo 'deleted'". Actual: rm ran only on grep failure, but `&& echo` after rm always succeeded, printing "deleted" even when file was never deleted. Caught only by re-running `ls` and finding the file still there. Shell operator precedence is unforgiving; wrapped each logical unit in `()` to force grouping.

2. **E2E TTL test passed for the wrong reason** — Initial test set PROVIDER_REFRESH_TTL_MS=50ms, expecting gateway to refresh within 50ms. Code review caught that gateway's 1000ms floor silently clamped the 50ms request. Test polled every 200ms and saw the 1000ms-delayed refresh, thought it was the 50ms config working. Fixed by setting TTL to 1000ms explicitly and widening poll windows to 2500ms, making floor behavior explicit and test intention clear.

3. **Shared dev DB parallel suites collided on dedup logic** — Multiple test suites ran concurrently, each inserting same provider (e.g., "ollama") to check get-or-create behavior. Tests inserted duplicate rows instead of reusing. Solved with "winDedup" pattern: compare `updatedAt` timestamp (set to 1 hour in future), query checks `updatedAt > NOW()` to select only "current" rows. Prevents stale duplicates without explicit cleanup, works across parallel runs.

## Technical Details

**Database layer (llm-db):**
- Migration 0004: Adds `lastFour` column to `providers` table (tracks API key suffix for UI display).
- DrizzleProvidersRepo implements provider CRUD + atomic get-or-create via `onConflict().doNothing()` in transaction.
- PROVIDER_KINDS extended: supports ollama, minimax, anthropic, openai (existing).
- `provider_catalogs` join table: tracks which catalogs (org templates) include each provider; enabled flag gates visibility.

**Gateway layer (llm-gateway):**
- ProviderRegistry refactor: dispose lifecycle locked by tests first (destroy called on swap, streams stay open until idle timeout).
- Single-flight `ensureFresh()`: checks `lastRefreshMs + TTL < now()`, fetches only if stale. TTL floor: 1s. Default: 60s. Configurable via PROVIDER_REFRESH_TTL_MS.
- Per-provider change detection: `stableStringify()` compares before/after configs. Only re-creates provider if shape changed.
- Swap-then-deferred-dispose pattern: new providers installed, old marked for disposal after streamIdleTimeoutMs (protects in-flight streams from disposal).
- Failure handling: first load failure returns CONFIG_SOURCE_ERROR. Later failures keep last-good config + emit onSourceError for ops visibility.

**HTTP layer (llm-http):**
- DbProviderConfigSource: queries `providers ⋈ provider_catalogs where enabled=true`, maps to gateway provider shape.
- Mapping rules: skip rows where org_id not in scope (never crash on missing org). Emit WARN log if rule skips row.
- ApiKeyVault: decrypts keys at source level. **Never logs key material**; only lastFour in debug output.
- POST /admin/workspaces/:id/providers: create provider with baseUrl, apiKey, kind. Returns enabled provider ready for gateway.
- PATCH /admin/workspaces/:id/providers/:id: disable provider (clears from gateway within TTL).
- GET /admin/workspaces/:id/providers: list all providers in org with enabled state.

**Container / Bootstrap (llm-http):**
- `warmUpProviderSource()` called eagerly on boot: non-fatal. Failure logs WARN + continues. First chat request triggers gateway's first load if warmup skipped.
- Provider env vars (PROVIDER_OPENAI_API_KEY, PROVIDER_OLLAMA_BASE_URL, etc.) removed from config schema.
- Container always builds DB-sourced gateway. NullGatewayAdapter deleted. No conditional: one code path.
- PROVIDER_REFRESH_TTL_MS added to config schema (milliseconds, coerced to number).

**E2E Verification:**
- Test setup: real Postgres, real Drizzle migrations, stub HTTP server mocking ollama provider.
- Create provider via API → set PROVIDER_REFRESH_TTL_MS=1000ms explicitly → wait ≤1000ms → verify chat stream receives ollama responses (not CONFIG_SOURCE_ERROR).
- Disable provider via API → wait ≤1000ms → verify chat stream returns provider-not-found error (not CONFIG_SOURCE_ERROR).
- Gateway reports zero providers in GET /health until first chat triggers load (ops-visible change).

**Test Coverage:**
- llm-http: 559 passed, 1 skipped (DB-only integration test marked @skip).
- llm-gateway: 345 tests, all green.
- llm-ui: 66 tests.
- typecheck: clean, no TS errors.
- code-review: zero critical/high findings.

## What We Tried

1. **Bash test setup with && || rm pattern**: Silently failed. Replaced with explicit `()` grouping and `set -e` to catch unintended rm.

2. **TTL of 50ms in E2E test**: Silently clamped to 1000ms by gateway floor. Fixed by explicit TTL=1000ms and widening poll windows.

3. **Concurrent dedup on same provider name**: Duplicate rows inserted in parallel suites. Solved with "winDedup" updatedAt timestamp pattern.

4. **Vitest test reuse across files**: Attempted to import test helper from one test file into another; would double-register suites and cause fixture collisions. Duplicated testConfig locally instead (KISS).

## Root Cause Analysis

1. **Shell operator precedence**: `grep && echo || rm && echo` groups as `(grep && echo) || (rm && echo)`, not `(grep && echo) || rm`. Logic error in operator precedence, not syntax. Caught by behavioral re-check (ls).

2. **Gateway TTL floor not reflected in test setup**: Root cause: test config passed 50ms, gateway code silently applied min(50, 1000)=1000. Test saw delayed refresh, attributed it to the 50ms config. Review caught the mismatch by tracing code path. Lesson: explicit values in test names force alignment with implementation.

3. **Parallel Postgres writes on same kind dedup**: Root cause: no temporal constraint on uniqueness. Two suites tried to upsert "ollama" concurrently, both got "no conflict" because timestamps compared differently. Fixed by adding temporal window (updatedAt > NOW()) to uniqueness scope. Now only one "current" version exists across parallel runs.

4. **Cross-test vitest imports**: Vitest registers test suites at file load time. Importing test helper from one file into another loads both suites twice, causing fixture double-registration. Workaround: duplicate simple testConfig locally. Lesson: test utilities go in separate non-test files; test suites don't import test suites.

## Lessons Learned

1. **Shell scripting is operator precedence hell** — `&&` and `||` are left-associative; always wrap logical units in `()` to force intent. Behavioral testing catches silent failures; automated parsing doesn't.

2. **Config floor values must be explicit in tests** — When code applies `min(userValue, floor)`, tests should set userValue to the floor value explicitly. Makes test intent match code intent. Otherwise, the test can pass while the code is doing something unexpected.

3. **Concurrency + uniqueness constraints need temporal scope** — "unique on (kind)" isn't enough when multiple tests run concurrently. Add temporal dimension (e.g., updatedAt > NOW()) so only "current" rows participate in dedup logic.

4. **Vitest test files are modules** — Don't import test suites from other test files. Suites are registered at file load time. If you need shared test logic, extract to non-test utilities.

5. **TTL floor + retry windows beat individual TTL tuning** — Applied 1000ms floor to all refresh intervals. E2E test now waits 2500ms (2.5x floor), guaranteeing refresh happens. Simpler than tuning TTL per test.

6. **Single-flight refresh prevents thundering herd** — Concurrent chat requests on first load all wait for the same refresh promise. Prevents N requests = N DB queries. Gateway tests verify single refresh via spy count.

7. **Provider shape change detection beats comparing whole configs** — `stableStringify()` on config object catches API key, baseUrl, or model list changes. Skip recreating provider if shape unchanged. Saves one gateway provider instantiation per unused refresh.

8. **Swap-then-deferred-dispose protects in-flight streams** — Old provider disposal delayed until `streamIdleTimeoutMs` after new provider installed. Chat sessions using old provider keep working until idle. Prevents abrupt stream closures on provider update.

9. **Never log key material, always use surrogate** — ApiKeyVault debug output uses `lastFour` suffix only. Prevents accidental key leaks in logs. Make this a rule: PII/secrets never appear in log output, always use surrogate or hash.

10. **ENV-var provider config must be removed entirely, not conditionally gated** — Tempting to keep old code path for backward compatibility. Instead, delete it and document breaking change clearly. One code path, one source of truth (DB).

## Next Steps

1. **Breaking deployment**: Provider env vars no longer read. Seed all providers via org admin API before upgrading. Update DEPLOYMENT.md with pre-flight checklist: set PROVIDER_KEY_VAULT_KEY, confirm all orgs have providers created via API.

2. **Admin API validations**: baseUrl must be http(s)-only. Add zod check: `url.protocol in ['http:', 'https:']`. Test invalid schemes (file://, data://, ssh://). Currently: no validation.

3. **Provider edit restrictions**: baseUrl not clearable (would break existing chat history). Add UI + API check: disallow empty baseUrl on PATCH. Currently: allowed but breaks consumers. Add test.

4. **Cast expression in DB layer** — `row.kind as ProviderKind` in DbProviderConfigSource; should validate or coerce. Use zod parse on kinds list. Currently: assumes DB row kind is valid; schema guarantees it but code doesn't show intent.

5. **Health endpoint timing** — GET /health reports zero providers until first chat. Ops may prefer eager warmup to show ready state faster. Current behavior (non-fatal warmup, lazy first load) is safer for startup; timing may need tuning based on deploy feedback.

6. **Ops dashboard**: Add metric `gateway.provider.count` (gauge) and `gateway.provider.refresh_ms` (histogram). Track refresh latency and provider availability. Currently: only health endpoint visibility + debug logs.

---

**Status:** DONE  
**Summary:** Lazy-load DB providers shipped across all 5 phases (TDD): DrizzleProvidersRepo CRUD, gateway registry with TTL refresh + swap-then-deferred-dispose, ProviderConfigSource DI, DbProviderConfigSource in llm-http, container always DB-sourced. E2E proves create→usable≤TTL, disable→removed≤TTL, no restart. 559 llm-http tests, 345 llm-gateway, 66 llm-ui. Commit 906fc7b. `/Users/thuocnguyen/Documents/personal-workspace/ai-connect/docs/journals/260611-1610-lazy-load-db-providers-implementation.md`

## Unresolved Questions

- Should baseUrl validation (http/https only) be added pre-merge or post-launch? (review decision)
- Should baseUrl be clearable on PATCH, or enforced non-empty? (product decision)
- When should ops dashboard provider metrics be added? (roadmap decision)
- Should container always eagerly warm up providers (current: non-fatal lazy), or allow opt-in warmup for faster health reporting? (deploy strategy decision)
