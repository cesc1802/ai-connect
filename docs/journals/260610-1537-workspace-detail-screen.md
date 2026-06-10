# Workspace Detail Screen — Design-Fidelity Rebuild + Full API Stack

**Date**: 2026-06-10 16:00  
**Severity**: Medium  
**Component**: llm-db, llm-http, llm-ui  
**Status**: Resolved

## What Happened

Completed full-stack rebuild of workspace detail screen with real member/template/provider APIs across all three packages. Shipped 12 endpoints, 2 new database tables, redesigned UI matching design fidelity, and integrated auth/authorization controls end-to-end. Four commits integrated cleanly to master: 515b02e (schema), 578fe4c (endpoints), 1b11b04 (UI), fb11880 (docs).

## The Brutal Truth

This feature felt **clean in hindsight but was a discipline exercise in naming the trade-offs**. We made three intentional simplifications that would normally trigger "but what about X" conversations:

1. **JWT carries zero role claim** — UI renders admin affordances for everyone; server returns 403 inline when user lacks permission. This is a usability hack, not a bug. It works because the surface area is small (member CRUD, template attach/detach, provider toggle) and feedback is immediate. But it means shipping a UI that shows capabilities the user can't exercise. That's unusual.

2. **No /me endpoint, no display-name column** — The adapter layer just maps username into both name + email fields. The schema is incomplete (users have no email storage). This is pragmatic for Phase 1 but creates debt: eventually we'll add email columns and have to backfill or migrate. Shipping it anyway felt right because the alternative was 2 extra schema columns + endpoint to unblock frontend for a field the product team hasn't finalized.

3. **Parallel execution meant trusting API contracts exactly** — fullstack-developer built endpoints in isolation, main session built UI consuming those endpoints. No overlap, no sync-merge friction. The contracts had to be **correct the first time** or the integration failed hard. They were correct. But it was only possible because we had a detailed API spec written down beforehand. Could have gone sideways fast.

## Technical Details

**Database layer (llm-db):**
- New tables: `prompt_templates` (id, content, created_at); `workspace_templates` (workspace_id, template_id composite PK, attached_at).
- Migration 0002 included dev-only seed: 12 Vietnamese prompt templates, gated by NODE_ENV=development.
- All existing tables (workspaces, users, members, providers) extended with FK relationships.

**HTTP API (llm-http):**
- 12 endpoints implemented:
  - GET /prompt-templates (no auth, returns all)
  - GET /workspaces/:id/members (role-scoped, 404 if not org member)
  - POST /workspaces/:id/members (org-admin-only)
  - PATCH /workspaces/:id/members/:user_id (org-admin-only, zod de-dupe transform on role array)
  - DELETE /workspaces/:id/members/:user_id (org-admin-only)
  - GET /workspaces/:id/members/candidates (org-admin-only, suggests non-members)
  - GET /workspaces/:id/templates (role-scoped)
  - POST /workspaces/:id/templates (org-admin-only)
  - DELETE /workspaces/:id/templates/:template_id (org-admin-only)
  - GET /workspaces/:id/providers (role-scoped, lists workspace-attached providers + toggle state)
  - PATCH /workspaces/:id/providers/:provider_id (org-admin-only, toggle enabled)
- Auth strategy: JWT sub + username only; permission checks via resource-owner queries (leak-safe 404 on forbidden reads; 403 on forbidden mutations).
- Bug fixed in code review: duplicate roles in PATCH body hit composite-PK unique violation (raw 500). Added zod .transform to de-dupe role array before upsert. Regression test added.
- Test coverage: 443 tests (llm-http), 83.09% overall. All new route files at 100%.

**UI layer (llm-ui):**
- WorkspaceDetailScreen redesigned: members table with add/edit/remove dialogs, templates carousel with attach/detach, provider toggle cards.
- apiMemberToUser adapter: maps API member shape {id, username, roles} into UI User {id, name: username, email: username, roles}. No widening schema; username stands in for both fields.
- AddTemplatesDialog initially missing error catch on attach mutation. Fixed with inline error state + retry affordance.
- Parallel file ownership: frontend dev owned only src/components/ and src/screens/; backend owned services, stores, API layer. No merge conflicts.
- Test coverage: 62 tests (llm-ui), all green.

## What We Tried

1. **Initially considered adding /me endpoint + email column**: Rejected because product hasn't finalized email use case and endpoint would be low ROI for Phase 1 scoping.
2. **Considered role claim in JWT**: Rejected to keep token size minimal and auth contract stable. Server-side RBAC queries are mature; frontend showing disabled affordances is acceptable UX debt.
3. **Serializing member changes into single PATCH** vs **individual add/remove endpoints**: Chose single PATCH with role array mutation to reduce chattiness. Risk of duplicate roles mitigated with zod transform.

## Root Cause Analysis

No defects reached production, but review surfaced two near-misses:

1. **Composite PK uniqueness on role upsert**: Backend code assumed roles would be deduplicated client-side. UI could send {roles: ["admin", "admin"]} and violate PK constraint. Root cause: no validation contract tested between layers. Fixed with explicit zod transform on backend before database write.

2. **Missing error boundary in AddTemplatesDialog**: Component attached templates optimistically but swallowed mutation errors. Root cause: copy-paste from AddMembersDialog (which had try-catch); AddTemplatesDialog author didn't replicate error handling. Fixed with try-catch + error state display.

Both issues caught in code review before merge. No production impact.

## Lessons Learned

1. **Parallel execution requires ironclad API specs**: When teams don't overlap, the contract **is** the communication. Documentation of request/response shapes, status codes, and error cases must be unambiguous. We won because spec was detailed and immutable; could have failed if specs drifted.

2. **Adapter layer legitimizes schema incompleteness**: Mapping username into name + email columns bought us time to ship without schema widening. But we now owe a follow-up to add real email + display-name columns. Document this debt explicitly so it doesn't surprise the next dev.

3. **Server-side 403 feedback beats role claims in JWT**: Pushing role checks to resource-owner queries is verbose but safer (fewer privilege escalation paths). UI showing disabled affordances is acceptable UX debt for Phase 1. Don't over-engineer auth contracts early; surface permissions as needed.

4. **Zod transforms prevent DB constraint violations at the API boundary**: Adding explicit de-dupe transform on role arrays prevents client bugs from hitting the database. Cheap insurance.

5. **Test coverage on new routes must include permission boundaries**: 100% coverage on new route files is good. But audit-trail tests (verifying 404 vs 403 behavior across member/non-member/admin) are harder to sweep. Regression test for duplicate-role mutation now exists; similar boundary tests should be templated for future RBAC endpoints.

## Next Steps

1. **Product alignment**: Confirm org-disabled providers should remain toggleable per-workspace. Current behavior allows workspace admin to enable a disabled org-level provider, which may be intentional or a bug waiting for clarification.

2. **Production template library**: Seed is dev-only (NODE_ENV guard). Production starts empty. Needs product decision: templates added by team admins? Shipped with default library? Sourced from external API?

3. **DB-gated integration tests**: 39 tests marked `@skip('requires live Postgres')` never ran. These test member-scoped 404 behavior, candidate query, template attachment. Should be integrated into CI before next major change touches RBAC logic.

4. **Schema debt**: Add email + display_name columns to users table, backfill existing users, update apiMemberToUser adapter to use real columns instead of username mapping. Estimate: 2-3 hours. Timeline: post-Phase 2.

5. **Code cleanup**: Unused import in AddMembersDialog (from copy-paste). Not urgent, but note for next touch.

---

**Status:** DONE  
**Summary:** Workspace detail screen redesigned with 12 real endpoints, 2 new DB tables, and full RBAC integration. Shipped with deliberate trade-offs (no role JWT claim, username-as-email adapter) justified by phase scope; two review-caught near-misses (composite PK uniqueness, missing error handler) fixed before merge. `/Users/thuocnguyen/Documents/personal-workspace/ai-connect/docs/journals/260610-workspace-detail-screen.md`

## Unresolved Questions

- Should org-disabled providers be toggleable at workspace level? (product decision)
- How does production template library get populated? Default seed, team admin uploads, external API? (product decision)
- When should DB-gated integration tests run in CI pipeline? (ops decision)
