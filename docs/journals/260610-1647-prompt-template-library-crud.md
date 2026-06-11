# Prompt Template Library CRUD — Full-Stack Feature + Design Bundle Integration

**Date**: 2026-06-10 17:00  
**Severity**: Medium  
**Component**: llm-db, llm-http, llm-ui  
**Status**: Resolved

## What Happened

Shipped complete prompt-template CRUD feature: design-spec UI built from claude.ai/design bundle (screen-templates.jsx) with search, category pills, client-side paging (9/page), create/edit dialogs, and delete confirmation. Backend adds admin-gated POST/PATCH/DELETE /prompt-templates endpoints with zod validation. Database adds nullable `body` column via migration 0003. All verification gates passed: 462 llm-http tests, 66 llm-ui tests, tsc clean, production build OK. Commit 1cdb88a.

## The Brutal Truth

This felt like a **clean ship, but the roughness was in the ORM layer and DB constraints**. Three things stung:

1. **Drizzle rejects undefined-valued properties under `exactOptionalPropertyTypes: true`** — Expected to pass `{name: "...", body: undefined}` to `.set()` and have it update only `name`. Instead, Drizzle threw on the undefined key. Had to strip keys manually into an explicit patch object before calling `.set()`. Small friction, but it broke assumption about partial updates.

2. **Foreign-key restrict caught a delete path we didn't anticipate** — `workspace_templates.template_id` has `onDelete: restrict`. Deleting a template attached to a workspace throws SQLSTATE 23503, which we map to 409 Conflict. DB-enforced restriction is *good* (prevents orphans), but the design showed delete affordances without surfacing "template in use" context. Users will see 409 inline; acceptable but UX debt.

3. **Empty string vs. null body inconsistency** — Code review caught UI sending `""` for blank bodies while API expected null. Zod transform normalizes blanks to null so "no content" has a single representation. Without it, migrations would have two representations of empty floating around forever.

## Technical Details

**Database layer (llm-db):**
- Migration 0003: Adds nullable `body` column to `prompt_templates` table.
- Drizzle-kit auto-named it `0003_fine_red_ghost.sql`; renamed to domain slug `0003_prompt_template_body.sql` and sed-updated `drizzle/meta/_journal.json` per project convention.
- Foreign key `workspace_templates.template_id` references `prompt_templates(id)` with `onDelete: restrict` — enforces template usage restriction at DB level.

**HTTP API (llm-http):**
- Three new endpoints, all admin-only (role-gated server-side):
  - **POST /prompt-templates**: Create with title, category, icon, body. Zod validates empty/null distinction. Returns 201 + created record.
  - **PATCH /prompt-templates/:id**: Update title, category, icon, body. Extracts non-undefined keys into patch object before `.set()` call to avoid Drizzle rejection. Returns 200 + updated record.
  - **DELETE /prompt-templates/:id**: Soft-delete or hard-delete (TBD product intent). Returns 204. SQLSTATE 23503 mapped to 409 Conflict if template attached to workspace.
- All endpoints check `ctx.user.roles.includes('admin')` with 403 response for unauthorized access.
- Zod schema: `body` field transforms empty string → null. Prevents duplicate empty representations.
- Test coverage: 462 tests total across llm-http; new endpoint files at 100% coverage including error paths.

**UI layer (llm-ui):**
- TemplateLibraryScreen (from design bundle screen-templates.jsx):
  - Search input (client-side filter on title + category).
  - Category pills (toggle filter state).
  - Paginated grid (9 items/page, client-side reset + clamp on filter change).
  - Hover-trash icon on each template card.
  - Delete confirmation dialog with inline error feedback.
- CreateTemplateDialog & EditTemplateDialog:
  - Title, category, icon picker (12-icon set).
  - Mono-spaced body textarea (syntax-highlighted prompt content).
  - Live preview pane (shows rendered template).
  - Submit disables on 403 error; shows "No admin access" inline.
- Test coverage: 66 tests in llm-ui; all green. Delete path tested with mock 409 response.

## What We Tried

1. **Passing undefined-valued keys to Drizzle `.set()`**: Failed under `exactOptionalPropertyTypes: true`. Switched to explicit patch object construction filtering undefined keys before `.set()` call.
2. **Empty string as valid body representation**: Code review flagged inconsistency. Zod transform now normalizes `""` and `null` to `null` at API boundary.
3. **Soft-delete vs. hard-delete for templates**: Not finalized. Currently hard-delete with 409 on template-in-use. Product decision pending on retention/audit trail needs.

## Root Cause Analysis

Two issues caught pre-merge:

1. **Drizzle ORM strictness on optional properties**: Root cause: TypeScript `exactOptionalPropertyTypes: true` combined with Drizzle's `.set()` validation expects all keys in the update object to be defined. We assumed undefined keys would be filtered automatically. Lesson: always check ORM-specific behavior for strict TS modes; don't assume null/undefined handling.

2. **Double representation of "empty"**: Root cause: frontend used `""` (empty string) to represent "no template body", API implicitly allowed both `""` and `null`. Without zod normalization, queries would have to handle both cases forever. Fixed with explicit transform at boundary.

Neither issue reached production. Both caught by code-reviewer subagent.

## Lessons Learned

1. **Strict TypeScript ORM modes need explicit patch objects**: When using `exactOptionalPropertyTypes: true` with an ORM like Drizzle, don't rely on implicit undefined filtering. Build the patch object explicitly with only the keys you want to update.

2. **DB-enforced constraints are safer than check-then-delete**: Foreign-key `restrict` prevents orphaned workspace-template records at the DB level. Beats an explicit "check templates for references" query (TOCTOU race). Accept that 409 errors are part of the contract; surface them clearly in UI.

3. **Zod transforms prevent dual representations**: Empty string vs. null for optional fields should be normalized at the API boundary, not left to clients. One transform in the schema saves two representations from leaking into the database.

4. **Design bundle speeds iteration but requires contract testing**: Building UI directly from design export (screen-templates.jsx) was fast. But the icon picker, pagination logic, and delete affordances had to be tested against actual API behavior. No UI mock; all integration tested.

5. **Admin-gated affordances with inline 403 feedback is acceptable Phase 1 UX**: UI shows create/edit/delete buttons for everyone. Server returns 403 on mutation. Users see error inline. This is not ideal (should gate affordances client-side), but Phase 1 scope justified it. Document as debt; fix in authorization phase when role claim ships to frontend.

## Next Steps

1. **Product decision**: Soft-delete or hard-delete for templates? Affects retention/audit trail design.
2. **Client-side role gating**: Currently UI shows admin affordances to all users. Should add role claim to JWT so UI can suppress affordances for non-admins. Estimate: 1–2 hours. Timeline: when workspace detail RBAC phase ships.
3. **Template in-use messaging**: 409 Conflict returns bare error. Add context: "Template attached to X workspaces. Detach first, then delete." Requires schema join; low priority.
4. **Design refinement**: Icon picker UI scrolls; product may want search/filter. Not tested at scale (12 icons fits in viewport). Monitor for feedback.

---

**Status:** DONE  
**Summary:** Prompt template library CRUD feature shipped: design-bundle UI with search/paging/delete, admin-gated REST API with zod validation, DB migration adds body column. Pre-merge fixes: Drizzle patch object construction (undefined key rejection), zod normalization (empty string → null). 462 llm-http tests, 66 llm-ui tests, full coverage on new endpoints. `/Users/thuocnguyen/Documents/personal-workspace/ai-connect/docs/journals/260610-1647-prompt-template-library-crud.md`

## Unresolved Questions

- Should deleted templates be soft-deleted (retained in audit log) or hard-deleted? (product decision)
- When does client-side role gating ship for admin affordances? (roadmap decision)
- At what template count does icon picker pagination become necessary? (design validation)
