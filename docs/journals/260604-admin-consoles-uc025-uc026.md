# Admin Consoles UC-025 / UC-026 — Team Cook

**Date:** 2026-06-04
**Plan:** `plans/260604-1830-admin-consoles-uc025-uc026/`
**Scope:** Org Admin Console (`/admin/org`, 3 tabs) + Workspace Admin Console (`/admin/workspace`, 5 tabs) + console-wide a11y verification gate.

## What shipped

8 phases, executed across 8 dev sessions with plan-approval gating.

| Phase | Scope | Key commits |
|---|---|---|
| 1 | JWT claim expansion (`org`, `orgRole`, `workspace`, `workspaceRole`), `requireOrgAdmin`/`requireWorkspaceAdmin` middleware, `AuditEvent` + `AuditEmitter` port + stdout adapter, shared admin Zod schemas, /admin/* route guards, 403 page, contrast-audit CLI wired into `pnpm lint` (24 token pairs verified) | foundations |
| 2 | Admin shell + APG-tabs + `DataTable`/`StatusBadge`/`FormDialog`/`EmptyState`/`useOptimisticMutation` primitives, all axe-clean light + dark | shell primitives |
| 3 | Org Users tab (invite + disable) | `18e4992`..`57577b9` |
| 4 | Org Providers tab — AES-256-GCM api-key vault, redact-log middleware, masked input, BR-094 enforced (`encryptedKey` never serialized) | `31c0d3d`..`90f170b` |
| 5 | Org Template Library (CRUD + tag regex `^[a-z][a-z0-9-]{0,23}$`) | `f29c8ae`..`3690e54` |
| 6 | Workspace Members + Roles (BR-099 last-admin guard client + server) | `f0549e5`, `500d26d`, `ffd4083`, `ef80338`, `4b6af15`, `c9bc916` |
| 7 | Workspace Providers + Templates (PUT-replace + ETag concurrency + subset rule + BindingSplitPane) | `7370f84`, `271d36c`, `03d3c08`, `228dbc5` |
| 8 | Workspace Quotas + console-wide a11y gate (16 axe sweeps across 8 tabs × 2 themes + `verify:a11y` script) | `cbc65f6`..`79d15d0` |
| – | Owner demo account fixture for end-to-end admin login (uncovered as dangling diff during recovery) | `985aae6` |

## Verification (all green)

- `pnpm -F @ai-connect/http typecheck` — clean
- `pnpm -F @ai-connect/ui typecheck` — clean
- `pnpm -F @ai-connect/http test` — 576/576 pass, 36 files
- `pnpm -F @ai-connect/ui test` — 203/203 pass, 39 files (includes 16-case a11y sweep)
- `pnpm -F @ai-connect/ui lint` — contrast audit 24/24 token pairs (light + dark)
- `pnpm -F @ai-connect/ui verify:a11y` — contrast + axe sweep + lint, end-to-end pass

## Non-negotiables preserved

- "NEVER ship a contrast issue" → contrast audit wired into `lint` and `verify:a11y`, CI-gated.
- "API keys never leave the server" (BR-094) → `OrgProvidersService.toWire()` strips `encryptedKey`; response is `{id, displayName, providerKind, isEnabled, hasKey, lastFour}` only. AddProviderDialog uses `type=password`, `autoComplete=off`, `data-1p-ignore`, resets form before close.
- "Optimistic + rollback within 50 ms" (BR-095) → `useOptimisticMutation` uses `queueMicrotask` for rollback.
- "Server-side role re-check on every admin endpoint" (BR-093/097) → `createRequireOrgAdmin()` / `createRequireWorkspaceAdmin()` mounted on every admin route.
- "Audit emit required on every write" (BR-096/NFR-007) → enforced; `force` path on quotas writes `forced=true` to audit.
- "403 page must NOT leak whether the org/workspace exists" → page returns generic message.
- "StatusBadge NEVER convey state by color alone" → every intent pairs an icon + text label.

## Recovery: worktree-isolation breakdown

Two implementation sessions (dev-6, dev-7) were spawned with `isolation: "worktree"` but ended up sharing the main repo. Detected when commit `4b6af15` (dev-6's "schemas, api, hooks") absorbed several of dev-7's untracked files.

Recovery (no destructive ops):
1. Paused both devs via `SendMessage`.
2. Inspected reflog → discovered dev-6's intended `--soft` reset had defaulted to `--mixed`, dropping dev-7's `b3989a0` from HEAD and leaving a `UU` on `handlers/index.ts`. The lost commit only contained a 4-line edit to `handlers/index.ts`, already content-merged on disk.
3. Resolved by `git add` of the already-merged index, committed dev-6's untracked components+tests as `c9bc916`, and the shared wiring (container + workspace-admin-route + handlers/index) as `03d3c08`. dev-8 + dev-7 picked up cleanly afterwards.

VETOED dev-6's request for `git reset --hard b3989a0` — no data loss had occurred, only blame-attribution drift.

**Lesson:** Worktree isolation is not guaranteed by the flag alone — verify `git worktree list` after spawn, or coordinate sequentially when two devs touch the same shared files (container, route trees, MSW handler index).

## Docs impact: major (deferred)

This change adds:
- New JWT claims (`org`, `orgRole`, `workspace`, `workspaceRole`) → needs entry in code-standards.md / system-architecture.md auth section.
- New admin route surface (`/admin/org`, `/admin/workspace`) → needs entry in codebase-summary.md.
- New `AuditEmitter` port + stdout adapter → needs entry in system-architecture.md observability section.
- New `verify:a11y` CI gate → needs entry in code-standards.md quality-gates section.
- New BR-094..BR-100 enforcement points → keep cross-ref in project-overview-pdr.md when the next PDR pass happens.

Not updating now to keep this team's blast radius scoped — recommend a follow-up `/ck:docs` pass.

## Open questions

- OQ-2 (admin-editable roles) still pending — Roles tab ships as static catalogue per the phase-6 fallback. Upgrading to CRUD is incremental.
- Quotas service uses `StubUsageCounter` returning 0 — real per-role usage counter wires when chat metering lands. Inline TODO documented; warning code path is tested via injection.
