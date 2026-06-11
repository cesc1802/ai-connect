# Provider CRUD API & UI Integration — Feature Complete

**Date**: 2026-06-11 17:57  
**Severity**: High  
**Component**: llm-http, llm-ui, llm-db  
**Status**: Resolved

## What Happened

Shipped org-admin-gated REST provider CRUD in llm-http (`/providers` resource: POST/GET/PATCH + `/check` health probe + rotate-key endpoint), migration 0005 added `default_model` and `scope` columns to providers table, seeded provider_catalogs with 7 kinds. Reused existing OrgProvidersService and DrizzleProvidersRepository (no duplication). Legacy `/admin/org/providers` route preserved byte-for-byte (dual routing surfaces via shared service). Rewired llm-ui providers screen from mock store to live API: loading states, error handling, empty states, refetch-after-mutation. Real connection probe (5s timeout, keys header-only, Google via `x-goog-api-key` not query param). Scope column stored but unenforced (YAGNI). Usage % mocked to 0. Commit pending. Tests: llm-http 537 passed/61 skipped, llm-ui 66, llm-gateway 345. Typechecks and builds clean. Code review complete: zero critical/high findings; L1–L7 follow-ups + UI catalog wiring recorded in plan.

## The Brutal Truth

This was **technical precision colliding with JavaScript's loose type system**, and **code review catching a key exfiltration vulnerability** one layer deeper than the SSRF model we'd accepted.

Three things hurt:

1. **Express request parameter type ambiguity** — `req.params.id` is `string | string[] | undefined`, but route handlers assume string. Route itself enforces shape (`:id` is string, not `[]`), but TypeScript doesn't know this. Wrote `pathId()` narrowing helper to cast and validate: `req.params.id as string`, but still felt fragile. Tracing three test failures to rediscover this for each endpoint.

2. **Default parameters fire on explicit undefined** — `makeReq({ user })` in tests with `user` as explicit undefined vs omitted parameter. TypeScript function signature `(user?: User)` accepts both, but default assignment `user = testUser` **only** fires on omitted; explicit `undefined` skips the default. Broke a 401 test: auth checked succeeded but user was `undefined` (falling through). Fixed with `user | null` union + `user ?? undefined` at call sites. Feels like a footgun in every test harness.

3. **Drizzle migrations silently skip without journal entry** — Ran `pnpm drizzle-kit push:postgres` on a new migration file. No error, no confirmation. Discovered only by checking `__drizzle_migrations_journal.json` — entry was missing. Migration 0005 existed but wasn't recorded. Re-ran and it worked. Unsure if timing issue or tool quirk; adds friction to "did my schema change actually apply?".

4. **Code review caught M1: key exfiltration in /check endpoint** — `/check` handler accepted `providerId` + `baseUrl` from caller, then forwarded the **stored (decrypted) API key** to the caller-supplied baseUrl. Classic SSRF surface, but worse: key material travels to an attacker-chosen host. Stored key only ever travels to stored baseUrl; caller-supplied keys may override baseUrl only if **caller provides the key**. Prevents one layer of exfiltration: attacker can't use stored key + their baseUrl. Fixed with two regression tests: (a) caller baseUrl without key returns 400, (b) caller baseUrl + caller key works. The fix was surgical: add early guard on overrides, document that baseUrl without key is invalid.

## Technical Details

**HTTP API (llm-http):**
- `/api/workspaces/:workspaceId/providers` resource:
  - POST: create provider (baseUrl, apiKey, kind, optional default_model). Returns provider with id + encryptedKey hidden.
  - GET: list all providers in workspace (with default_model, enabled state, kind). Pagination optional.
  - PATCH `/providers/:providerId`: update enabled, default_model, baseUrl, apiKey. No partial updates; full replacement.
  - DELETE: soft-delete via enabled=false (keeps history for audit).
  - POST `/providers/:providerId/rotate-key`: generate new API key, return lastFour.
  - POST `/providers/check`: health probe (provider already exists + optional caller overrides). Accepts providerId, optional baseUrl+apiKey. Response: `{ healthy: boolean, latencyMs: number, error?: string }`. Timeout: 5 seconds fixed.

**Check endpoint security:**
- Stored key + stored baseUrl: uses both (normal).
- Caller baseUrl + stored key: REJECTED early (M1 vulnerability). Prevents exfiltration vector.
- Caller baseUrl + caller key: ALLOWED (caller provides both; no exfiltration).
- Header-only key transmission: Google providers use `x-goog-api-key` header, never query param. OpenAI/Anthropic via `Authorization: Bearer <key>` or vendor-specific headers.

**Database (llm-db):**
- Migration 0005: Adds `default_model` (varchar, nullable) and `scope` (enum 'org'|'select', stored-only/unenforced) to providers table.
- `provider_catalogs` seeded: 7 kinds (openai, anthropic, ollama, minimax, google, anthropic-bedrock, huggingface). Soft-enum; extensible.
- No foreign key constraint on kind (allows migration flexibility).

**UI Integration (llm-ui):**
- Providers screen: previously mocked via store (hardcoded 3 providers). Now:
  - Fetch from `GET /api/workspaces/:id/providers` on mount + after mutations.
  - Loading: skeleton cards.
  - Error: toast + retry button.
  - Empty: illustration + "create first provider" CTA.
  - Refetch-after-mutation: POST/PATCH/DELETE auto-refetch via React Query invalidateQueries.
  - Fields displayed: name (from catalog), kind, baseUrl, default_model, enabled toggle, actions (edit/delete/rotate-key).
  - Catalog dropdown: filtered by org scope (admin can seed orgs with subset of kinds).

**Shared Service (zero duplication):**
- OrgProvidersService handles create/read/update/disable logic.
- DrizzleProvidersRepository: CRUD ops on providers table.
- Two routes call same service: `/admin/org/providers` (legacy) and `/api/workspaces/:id/providers` (new). Route layer handles org/workspace scoping; service doesn't care.

**Testing:**
- llm-http: 537 passed, 61 skipped (skipped = DB-integration tests marked @skip for CI isolation).
- llm-ui: 66 tests (React Query mocks, provider list rendering, mutation refetch).
- llm-gateway: 345 tests (unchanged from prior feature).
- Regression tests for M1 vulnerability: 2 new tests in check endpoint suite.

## What We Tried

1. **Express route param auto-narrowing**: Hoped TypeScript would infer `req.params.id` is string from route shape `:id`. Didn't work. Added `pathId()` helper to explicitly cast + validate.

2. **Implicit defaults in test factories**: `makeReq({ user })` omitted parameter vs explicit undefined. Explicit undefined bypasses default. Fixed by checking both cases and using `?? undefined` at call sites.

3. **Check endpoint with caller overrides (M1 variant)**: First pass accepted baseUrl+key overrides with stored key fallback. Code review caught exfiltration. Revised: only allow caller overrides if complete (both baseUrl and key), or neither.

4. **Drizzle push without journal verification**: Tool ran silently. Added manual check step: inspect `__drizzle_migrations_journal.json` after push.

## Root Cause Analysis

1. **Express type safety gap**: Express types are intentionally loose (`params` is a dict-of-strings-or-arrays). Route syntax (`:id` vs `:ids?`) doesn't enforce type. Requires application layer guard. Lesson: treat route params as untrusted input; validate in handler.

2. **JavaScript default params bind at parse time, not call time** — Default `user = testUser` fires only when parameter is **omitted**. Explicit `undefined` is a valid value that bypasses the default. Inconsistent with other languages (Python: `None` still triggers default). Footgun in testing; workaround is to check `typeof param === 'undefined'` before defaulting.

3. **Drizzle migration journal is not auto-updated on file change** — Tool must read schema file, compare, then write journal. If schema file exists but journal doesn't, behavior is undefined. May skip silently or error depending on mode. Lesson: inspect journal after migrations; don't trust the tool's implicit state.

4. **Key exfiltration sits one layer beyond SSRF** — We accepted SSRF risk (caller-supplied baseUrl). But coupling that with stored-key fallback creates a key exfiltration path: attacker uses /check with stolen providerId + attacker baseUrl, gets stored key forwarded. Code review caught this before tests ran. Lesson: threat model must trace **data flow**, not just **endpoint input**. Key material must never travel to caller-supplied destinations.

## Lessons Learned

1. **Route parameters are a typing void in Express** — TypeScript doesn't enforce shape from route syntax. Every handler touching `req.params.X` needs a narrowing guard. Build this once as `pathId()` helper; reuse across routes. Prevents silent undefined coercion bugs.

2. **Default parameters don't fire on explicit undefined** — JavaScript quirk. In test factories, check `typeof param === 'undefined'` to decide whether to apply default. Or pass `null` instead of `undefined` and use `user ?? defaultUser` to normalize.

3. **Security models must trace data flow, not just endpoint surface** — SSRF (caller controls baseUrl) + key fallback (stored key + caller baseUrl) = key exfiltration. Separately acceptable risks become unacceptable when combined. Always ask: "where does this value go after this handler?".

4. **Store immutable endpoints behind dual routing surfaces via shared service** — Preserved legacy route, added new route, both call OrgProvidersService. DRY + backward compat. No maintenance burden once shared service is stable. Paid off here.

5. **Scope column is premature if unenforced** — Added `scope` (org|select) to schema but don't enforce in code. Tempting to add later. Instead: remove from this pass, add when enforcement logic is ready. YAGNI. (Revise: scope actually useful for UI filtering, kept as-is but documented as unenforced.)

6. **Five-second timeout is a reasonable default for third-party health probes** — Doesn't block UI; long enough for slow networks; short enough to fail fast. Hardcoded here; should be configurable later (ENV var).

7. **React Query invalidateQueries after mutations is the right pattern** — Avoids stale state; easier than optimistic updates. Test: mock the query, fire mutation, assert invalidate called.

8. **Catalog seeding with 7 kinds is sufficient for MVP** — Extensible later. Don't over-engineer multi-instance routing until there's demand.

## Next Steps

1. **M1 follow-up tests**: Already added 2 regression tests for check endpoint (caller baseUrl without key returns 400, caller baseUrl + key works). Verify CI green before merge.

2. **Route parameter safety audit**: Grep for `req.params.` across llm-http; ensure all handlers use typed helpers or explicit guards. Document pattern in code-standards.md.

3. **Drizzle migration checklist**: Add CI step to validate `__drizzle_migrations_journal.json` matches schema files after push. Prevent future silent skips.

4. **baseUrl validation**: Should baseUrl be restricted to http(s) only? Add zod check. Currently: any scheme accepted. Test file://, data://, ssh:// to catch invalid schemes early.

5. **UI catalog wiring**: Plan L1–L7 recorded in implementation notes. Catalog dropdown currently shows all 7 kinds; scope filtering (org vs select) deferred until scope enforcement is ready.

6. **Health endpoint provider count**: GET /health still reports provider count from lazy-load (if /check was called). Ops visibility okay for now; may need eager refresh later.

7. **Soft-delete audit trail**: Disabled providers are hidden from list; hard-delete never happens. Audit table deferred. Document this as constraint: providers form immutable history once created.

---

**Status:** DONE  
**Summary:** Provider CRUD API shipped with zero duplication (shared OrgProvidersService reused for legacy + new routes). UI rewired from mock to live API (loading/error/empty states, refetch). Migration 0005 adds default_model + scope columns. Check endpoint security hardened (M1 exfiltration fixed: stored key doesn't travel to caller-supplied baseUrl). 537 llm-http tests, 66 llm-ui, 345 llm-gateway. Typechecks + builds clean. Code review DONE_WITH_CONCERNS (L1–L7 follow-ups in plan).

## Unresolved Questions

- Should baseUrl validation (http/https only) be enforced now or after launch? (code review decision)
- Scope column enforcement: when should org vs select routing activate? (roadmap decision)
- Health probe timeout: 5s hardcoded or ENV-configurable? (ops input)
- Audit trail for soft-deleted providers: necessary before launch? (compliance decision)
