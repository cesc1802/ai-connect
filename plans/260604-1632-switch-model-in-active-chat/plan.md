---
title: "UC-021 Switch Model in Active Chat"
description: "Add a workspace-scoped model picker to the chat header (llm-ui). Surface only providers in the workspace + models the user's role can use, persist the selection per-workspace in Zustand, and forward the chosen `(providerId, modelId)` to the WS chat-send command via the existing `modelHint` field. MSW-mocked resources endpoint until UC-015 backend ships."
status: pending
priority: P2
effort: 12h
branch: master
tags: [llm-ui, frontend, react, shadcn, zustand, zod, tanstack-query, msw, uc-021, fr-019]
created: 2026-06-04
blockedBy: [260604-1423-llm-ui-base-project]
blocks: []
---

# Plan — UC-021 Switch Model in Active Chat

## Overview

Add a model selector dropdown to the chat header so a workspace member can change the model used for the **next** turn. Selection is restricted to models whose provider is in the active workspace's `WORKSPACE_PROVIDER` set and `isEnabled = true`, and further filtered by the actor's role (BR-083, BR-084). A model switch never aborts the in-flight assistant reply (BR-085); it applies only to subsequent sends.

This plan is **UI-only**. Backend UC-015 (`GET /workspaces/:id/resources`) is "Proposed" and ships in a separate backend plan. Here we mirror its contract in a Zod schema and MSW handler so the UI can be built, tested, and accepted in isolation. The real endpoint swap is a config flip once the backend lands.

The `ChatSendCmd` schema already carries an optional `modelHint` field (`llm-ui/src/schemas/ws-events.ts:13`); this plan wires it.

## Requirements covered

| ID  | Title | Phase |
|-----|-------|-------|
| FR-019 | Model Selector in Chat Header | 4, 5 |
| NFR-016 | WCAG 2.1 AA — listbox semantics | 4, 6 |
| NFR-017 | Keyboard Navigation — arrow/Enter/Esc | 4, 6 |
| NFR-021 | Type Safety End-to-End (Zod at API boundary) | 1, 2 |
| BR-053 | Provider Source Restriction (enabled providers only) | 1, 4 |
| BR-083 | Selector Source Restriction (workspace providers only) | 4 |
| BR-084 | Role Filter on Selector | 1, 4 |
| BR-085 | Switch Does Not Restart Stream | 5 |

Out of scope: real backend resources endpoint (separate plan for UC-015), template picker (UC-022), per-role quota enforcement (UC-013), admin provider CRUD (UC-007/UC-010).

## Dependencies

- **blockedBy:** `260604-1423-llm-ui-base-project` — needs the chat page, WS client, Zustand+Zod+TanStack Query+MSW base, and shadcn primitives (`dropdown-menu`, already present).
- Reuses `ChatSendCmd.modelHint` from `llm-ui/src/schemas/ws-events.ts`.
- Reuses `useActiveWorkspaceStore` for the active workspace id.
- Mirrors UC-015 response shape; when UC-015 backend ships, only the MSW handler is replaced.

## Phases

| # | Phase | File | Effort | Status |
|---|---|---|---|---|
| 1 | Resources schema + MSW mock (providers + models, role-aware) | [phase-01](./phase-01-resources-schema-and-msw-mock.md) | 2h | pending |
| 2 | Workspace resources hook (TanStack Query) | [phase-02](./phase-02-workspace-resources-hook.md) | 1h | pending |
| 3 | Chat model selection store (Zustand, workspace-keyed) | [phase-03](./phase-03-chat-model-selection-store.md) | 1.5h | pending |
| 4 | `ModelSelector` component (shadcn dropdown, listbox a11y) | [phase-04](./phase-04-model-selector-component.md) | 3h | pending |
| 5 | Chat-header integration + `modelHint` wiring in `useChatSession` | [phase-05](./phase-05-chat-header-integration-and-modelhint-wiring.md) | 2h | pending |
| 6 | Tests (unit, component, integration, a11y) | [phase-06](./phase-06-tests-and-accessibility-validation.md) | 2.5h | pending |

Phases are strictly sequential. Phase 6 can begin alongside Phase 5 once Phase 4 lands.

## Key Risks

- **Contract drift vs. UC-015 backend.** We invent a JSON shape before the backend ships. Mitigation: keep the Zod schema isolated in one file (`llm-ui/src/schemas/resources.ts`); when backend lands, diff and adjust in one place. The Zod parse boundary surfaces mismatches as a typed error, not a silent crash.
- **Role mismatch between UI store and resources response.** The user's role for a workspace is already in `Workspace.role` (`llm-ui/src/schemas/workspace.ts:17`). MSW must honor that role when filtering; tests must cover each role.
- **Selector during streaming (A3).** A naive implementation might abort the in-flight reply. The `modelHint` is read only at `sendMessage` call time (already true in the current `useChatSession` flow), so as long as we don't push the new model into the live WS connection, BR-085 holds. Phase 5 must add a regression test.
- **Empty-state UX (A1).** No enabled providers ⇒ disabled dropdown with hint. The chat composer is already disabled when `workspaceId == null`; we should NOT also disable it when models are empty (BR-085 covers retroactive; sending without a `modelHint` is allowed — server picks default). Confirm with the user during validation.
- **Stale dropdown (A2).** Provider disabled between open and select. Mitigation: refetch resources on every dropdown open (`refetchOnMount`) plus rely on TanStack Query cache invalidation on workspace change.

## Success Criteria (rolled up)

- Opening the dropdown in the chat header lists models grouped by provider, restricted to workspace providers with `isEnabled = true` and respecting the actor's role.
- Selecting a model updates the header label and is persisted per workspace (survives reload).
- Next `c.chat.send` carries `modelHint` = `"providerId/modelId"` (or agreed encoding).
- Switching models during an in-flight reply does NOT abort that reply (BR-085).
- Dropdown is keyboard-operable (arrow keys, Enter, Esc) and exposes `role="listbox"` with `aria-activedescendant`.
- `pnpm --filter @ai-connect/ui typecheck` clean, all Vitest suites green, axe-core scan clean on the chat page.

## Validation Methods

- Per-phase: `pnpm --filter @ai-connect/ui {typecheck,test}` exit 0.
- Integration: in dev mode (MSW on), pick a workspace, switch model mid-stream, send next turn, observe `modelHint` in the outbound WS frame (devtools).
- A11y: axe-core scan on chat page; manual keyboard walkthrough.

## Open Questions

1. **`modelHint` encoding.** Pick one: `"providerId/modelId"` (slash form, matches OpenAI-style routing) vs. `"providerId:modelId"` (colon form). Plan assumes `"providerId/modelId"` — confirm with backend owners before Phase 5.
2. **Default selection.** When the workspace has providers but no prior user selection, do we (a) leave it unset and let the server pick, or (b) auto-select the first enabled model? Plan assumes (a) — surface in validation interview.
3. **Disabled-provider visibility.** UC-015 A2 says disabled providers stay in the response so the UI can grey them out. UC-021 BR-053 says the selector lists only enabled providers. Plan follows UC-021 (hide disabled). Confirm.
