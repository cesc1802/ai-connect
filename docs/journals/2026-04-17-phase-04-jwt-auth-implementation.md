# Phase 4: JWT Auth Implementation - Caught Critical Timing Attack Before Production

**Date**: 2026-04-17 14:30
**Severity**: High (vulnerability discovered and fixed)
**Component**: Auth feature (JwtService, CredentialsVerifier, UserRepository)
**Status**: Resolved

## What Happened

Implemented JWT-based authentication from scratch: user storage abstraction (Repository pattern), credential verification with bcrypt, JWT token signing/verification (HS256), auth middleware, and login/register routes. Created 84 unit and integration tests. Code review caught a **critical timing-attack vulnerability in the DUMMY_HASH before merging**.

## The Brutal Truth

This is the kind of bug that ships in production and only surfaces during a security audit six months later. The dummy hash was malformed—49 characters instead of 60—which meant timing comparisons would fail at different points depending on password length, leaking information about the real hash. We only caught it because someone *actually reviewed the code*.

The frustration: timing-safe comparisons exist in bcrypt for a reason. I knew that. But cutting corners on a "test hash" is how you end up with a "minor" security issue that becomes a major incident.

## Technical Details

**Vulnerability Fixed:**
- DUMMY_HASH was `$2b$10$` + 43 chars = 49 total
- Real bcrypt hashes: 60 characters exactly
- `timingSafeEqual()` would fail at different iterations depending on input, leaking timing info
- Attacker could measure response times to infer valid usernames

**Error Messages & Stack Traces:**
- Code review flagged: "DUMMY_HASH length mismatch in CredentialsVerifier"
- Missing `await` in middleware causing unhandled promise rejection in register route
- JwtService calling verify() without explicit algorithm parameter (accepting any algo)

**Code Changes:**
```typescript
// BEFORE (vulnerable):
const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuvwxyz'; // 49 chars

// AFTER (secure):
const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR'; // 60 chars

// JWT verification:
// BEFORE: crypto.timingSafeEqual(decoded, secretKey)
// AFTER: jwt.verify(token, secret, { algorithms: ['HS256'] })
```

## What We Tried

1. **Initial timing-safe implementation** — Assumed bcrypt's comparison was enough
2. **Missing explicit algorithm in verify()** — JWT spec allows algorithm confusion attacks
3. **Unhandled async errors in middleware** — Route handlers needed try-catch + next(err)

All three caught during code review before hitting tests.

## Root Cause Analysis

Three design oversights:

1. **Cargo-culting bcrypt without validating DUMMY_HASH format** — I knew timing-safe comparison needed matching lengths but didn't verify the constant itself
2. **JWT verify without explicit algorithm** — Accepted the default instead of enforcing HS256
3. **Async/await in Express middleware is error-prone** — Promise rejections don't automatically call next(err)

The real lesson: security features only work if you *validate the constants and configurations*, not just the algorithms.

## Lessons Learned

- **Never skimp on test data security** — DUMMY_HASH is security-critical; it's not "just for testing"
- **Explicit > Implicit** — Always specify algorithms, not defaults (JWT, crypto, etc.)
- **Code review catches what tests miss** — Tests pass; security logic still breaks if the constants are wrong
- **Timing attacks are real** — Response time differences of microseconds matter at scale

## Next Steps

1. ✅ Fixed DUMMY_HASH to 60 characters (proper bcrypt length)
2. ✅ Added explicit `algorithms: ['HS256']` to jwt.verify()
3. ✅ Wrapped all async route handlers in try-catch + next(err)
4. ✅ All 84 tests passing (unit + integration)
5. Document timing-attack vulnerability in `./docs/code-standards.md` as a warning for future credential handling

**Ownership:** Security review complete; ready for merge.

## Architecture Decisions Made

- **Feature folder structure** (`auth/`) vs layer-based — cleaner co-location of related code
- **Repository pattern** — Enables swapping InMemoryUserRepository with DB without touching business logic
- **Manual DI container** — No decorators/IoC framework; explicit is better
- **Express type augmentation** (`req.user`) — Type-safe custom properties

No regrets on these choices. The timing-attack catch proves code review works.
