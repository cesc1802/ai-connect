# Auth: Login + Register on Service/Repository Layers, Postgres-Backed

**Date**: 2026-06-09 22:20
**Severity**: Medium
**Component**: llm-http (auth module, container, app wiring)
**Status**: Resolved

## What Happened

Reshaped `llm-http/src/auth` into a clean Controller → Service → Repository stack and added a real DB-backed login plus a new register endpoint. Login logic moved out of the route handler into `AuthService`; the user repository is now Postgres-backed via Drizzle. All tests pass (llm-http 362 + 10 skipped). tsc clean.

## The Brutal Truth

The "login API" already existed — the actual gap was that it never touched the database. The container *always* built `InMemoryUserRepository` (even under `PERSISTENCE=drizzle`), so login only ever checked seeded demo users. The real work was wiring the existing `users` table in, extracting business logic into a service, and adding register. User explicitly chose to **remove the in-memory user repo entirely**, which has a non-trivial consequence: the app now requires Postgres to boot, full stop. That was surfaced and confirmed, not assumed.

## Technical Details

### 1. Layering
- **Repository**: `UserRepository` interface gained `create()`; new `DrizzleUserRepository` (findByUsername + create) mirrors the existing `DrizzleConversationRepository` pattern. `InMemoryUserRepository` kept **only** as a test double for the integration test (no DB needed in unit tests).
- **Service**: new `AuthService.login()` (verify creds → issue JWT) and `register()` (bcrypt hash cost 10 → repo.create).
- **Controller**: `auth-routes.ts` is now thin — zod validation + map service results to HTTP. Added `POST /register`.

### 2. Security decisions (deliberate)
- **Role hardcoded to `"member"` in `register()`** — never read from the request body, so signup cannot self-assign admin.
- **Register returns `201 {id, username}` only** — no token, no passwordHash leak.
- **Unique-violation → 409**: insert catches Postgres SQLSTATE `23505` and throws `UsernameTakenError`, mapped to 409 in the controller. No read-then-write, so no TOCTOU race — the DB constraint is the source of truth.
- **Rate limiting**: `/register` runs bcrypt + a DB insert per unauthenticated call (DoS / enumeration target). Reused the existing login limiter across both `/auth/login` and `/auth/register`; generalized its message to cover both.

### 3. Container consequence
`buildContainer` now creates the Drizzle `DbClient` unconditionally and throws if `DATABASE_URL` is missing. `AppContainer.dbClient` went from optional to required; the one external consumer (`index.ts` shutdown `close()`) keeps its now-always-true guard — harmless, no behavior change. `PERSISTENCE` still selects only the conversation/message repos.

## Orphans / Follow-ups
- `config.DEMO_USERS` (+ `demoUsersSchema`) is now dead config — still parsed on boot, never read. Left in place (surgical); safe to remove later.
- Removed the now-unused `seedUsers()` helper from `seed-users.ts` (orphaned by dropping the in-memory wiring); `seedDrizzleDevData` stays.

## Unresolved Questions
None.
