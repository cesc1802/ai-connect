# Lazy-Load DB Providers Plan — TDD Grounding & Material Gaps Found

**Date**: 2026-06-11 12:49  
**Severity**: High  
**Component**: llm-gateway, llm-http, llm-db  
**Status**: Plan Complete

## What Happened

Created formal TDD implementation plan (`plans/260611-1249-lazy-load-db-providers-into-gateway/`) from brainstorm design (5 phases, 23h, P1). Plan grounding (tracing design through actual code) surfaced two material schema/capability gaps that brainstorm missed. User confirmed both; plan updated with phase 1 additions. Dependency chain hydrated: phases 1+2 parallel; 3←2; 4←1+3; 5←4. Plan gates ready; user deferred red-team validation to `/ck:plan` before `/ck:cook` due to blast radius (secrets, DB migration, deploy breaking change).

## The Brutal Truth

**Gap discovery stung because schema was "right-ish but incomplete."** The `providers` table exists, Drizzle repo exists — looked like persistence was done. Reality: org admin CRUD writes to an `InMemoryProvidersRepository` (lines 167 in container.ts) that never touches Drizzle. Rows created in admin UI vanish on restart. Brainstorm assumed DB persistence was baked; it wasn't. User had to backpedal plan scope mid-session.

Second gap (provider kinds mismatch) was less painful but stung the ship-readiness: removing env-var config (design goal) silently kills `ollama` and `minimax` providers because `PROVIDER_KINDS` lacks them. Gateway code already supports both via env, but schema doesn't know them. Caught before coding; would have shipped a breaking change unnoticed.

The lesson: **test assumptions against real code before locking plan scope.** Brainstorm is high-level; grounding must be surgical.

## Technical Details

### Gap 1: Org Admin Provider CRUD → InMemory, Not DB

**Current flow (broken):**
- `llm-http/src/container.ts:167`: `new InMemoryProvidersRepository()` in org admin service.
- Admin creates provider → saved to in-memory map only.
- Drizzle `providers` table exists but unused by admin service.
- On restart: in-memory cleared, providers vanish.

**Plan fix:**
- Phase 1 adds `DrizzleProvidersRepository` (Drizzle-backed org provider CRUD).
- Admin service injects Drizzle repo instead of in-memory.
- Schema updates: `displayName` → `alias` (clarity), `encryptedKey` → `api_key_ref` + new `last_four` column (denormalize key preview without decrypt per read), `kind` → join `provider_catalogs` to get-or-create catalog on create (dedup).
- Migration: `000X_providers_schema_updates.sql`.

### Gap 2: Provider Kinds Mismatch

**Current state:**
- `PROVIDER_KINDS` in `llm-http/src/admin/org/provider-kind.ts`: missing `ollama`, `minimax`.
- Gateway (`llm-gateway/src/`) supports both via env-var fallback.
- Removing env config (design goal) would silently kill those providers.

**Plan fix (phase 1):**
- Extend `PROVIDER_KINDS` to include `ollama`, `minimax`.
- Add optional `baseUrl` field in admin provider API (some providers need custom endpoints).
- Gateway load-time: `google`, `azure-openai`, `custom` rows from DB → skip with warning (not in `ProviderName` union; multi-instance future work).

### Other Notable Decisions

- **Org_id absence**: `providers` table has no `org_id` column (system single-org today). Drizzle repo accepts `orgId` param for interface compat but doesn't filter on it. Documented, not silently dropped.
- **Breaking deploy change**: Removing env provider config means DB must be seeded before upgrade. Migration order matters. Flagged for deploy checklist.
- **Dependency chain**: 1 + 2 parallel; 3←2; 4←1+3; 5←4. Critical path: 1→4→5 or 2→3→5 (23h total).

## What We Tried

1. **Assumed DB persistence existed**: Brainstorm design said "providers stored in database" — schema-deep true (table exists), behavioral lie (admin CRUD never touches it). Assumption cost plan scope revision mid-grounding.
2. **Assumed all provider kinds were in schema**: `PROVIDER_KINDS` looked authoritative; it wasn't. Env fallback masked incompleteness.

## Root Cause Analysis

**Gap 1 root cause**: Admin service was scaffolded early with in-memory repo as a placeholder. Later, Drizzle schema was added to support gateway config load, but admin service wiring was never updated. No test validated that admin-created providers reached the DB. Persistence was "planned but not wired."

**Gap 2 root cause**: New provider kinds (`ollama`, `minimax`) were added to gateway env logic but not to the admin kind registry. Admin UI couldn't create them (or created them with unknown kind enum value). Schema drift between admin and gateway.

Both gaps exist because **no integration test validates "provider created via admin API is queryable by gateway"**. Black-box thinking: admin and gateway were tested in isolation.

## Lessons Learned

1. **Grounding must be code-deep, not schema-deep**: A table existing ≠ code using it. Trace the request path through actual wiring. "Persistence exists" means nothing if the code doesn't call `db.insert()`.

2. **Multi-component systems need integration tests early**: Admin and gateway both talk about providers; no test enforced the contract. A single "create provider via admin, query via gateway" test would have caught both gaps pre-brainstorm.

3. **Schema vs. code drift is silent**: Enum in code, table column in schema, validation nowhere. Diff them explicitly during planning, not during code review.

4. **Placeholder implementations live longer than expected**: In-memory repo was "temporary pending DB integration." It wasn't. Six months later, still in production. Placeholder code needs an explicit deprecation timeline.

## Next Steps

1. **Phase 1 hydration**: Add `DrizzleProvidersRepository`, migration (schema rename + `last_four`), `PROVIDER_KINDS` extend (ollama/minimax), optional `baseUrl` field in admin API.
2. **Red-team gates before `/ck:cook`**: Deploy breaking change (env removal), migration ordering, secrets handling. User recommended `/ck:plan` red-team due to blast radius.
3. **Integration test anchor**: Add "admin create → gateway query" test before phase 1 ships. Prevent future drift.
4. **Deploy checklist**: Document that DB must be seeded **before** env-var code is removed. Staging-only test first.

---

**Status**: DONE  
**Summary**: TDD plan created (5 phases, 23h, P1) with dependency chain; two material gaps discovered during code grounding (admin provider CRUD wired to in-memory not DB; PROVIDER_KINDS lacks ollama/minimax). Both confirmed by user; phase 1 scope updated. Plan gates ready; red-team deferred to `/ck:plan` before cook due to deploy breaking change + migration + secrets risk.

## Unresolved Questions

- Confirm `last_four` migration is acceptable at phase 1 (vs. decrypt-on-read)?
- Deploy sequence (staging test before prod env-var removal)?
