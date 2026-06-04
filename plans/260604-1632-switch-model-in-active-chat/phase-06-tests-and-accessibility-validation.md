---
phase: 6
title: "Tests and Accessibility Validation"
status: pending
priority: P2
effort: "2.5h"
dependencies: [5]
---

# Phase 6: Tests and Accessibility Validation

## Overview

Lock in UC-021 behavior with Vitest + Testing Library suites covering the main flow, all three alternative flows (A1 no models, A2 stale provider, A3 switch mid-stream), the role filter (BR-084), and keyboard/listbox a11y (NFR-016, NFR-017).

## Requirements

- **Functional:** Tests for: schema parsing, role filtering in MSW, store persistence + clearAll, selector rendering + selection + empty state, `sendMessage` carries `modelHint`, BR-085 (mid-stream switch).
- **Non-functional:** axe-core scan via `vitest-axe` on the open dropdown returns no serious/critical violations. Manual keyboard walkthrough documented in `success criteria`.

## Architecture

Files (each ≤200 lines per repo rules):

- `llm-ui/src/__tests__/resources-schema.test.ts` — Zod parse round-trips for `WorkspaceResourcesResponse`.
- `llm-ui/src/__tests__/resources-handlers.test.ts` — hit MSW with different workspace ids and assert filter behavior.
- `llm-ui/src/__tests__/chat-model-store.test.ts` — set, get, persist (mock localStorage), clearAll on logout.
- `llm-ui/src/__tests__/model-selector.test.tsx` — render with fixtures, click open, click model, assert store updated; empty state; stale selection display; keyboard ↑/↓/Enter/Esc; axe-core.
- `llm-ui/src/__tests__/use-chat-session-modelhint.test.ts` — assert outbound WS frame contains `modelHint` after store is set; assert frame omits `modelHint` when store is empty; assert switching store during a streaming reply does not call `client.abort` (BR-085).

## Related Code Files

- Create all five test files listed above.

## Implementation Steps

1. **Schema test:** parse a happy-path fixture, parse a malformed payload, assert errors.
2. **MSW handler test:** wrap with the `setupServer` already used in `__tests__/setup.ts`; fetch `/api/workspaces/wsp_personal/resources` and assert (a) disabled provider absent, (b) `allowedRoles` field absent, (c) for `wsp_acme` (admin), role-restricted entries respect role.
3. **Store test:** seed via `setModel`, reload (re-import after persist), assert value still present; assert `clearAll` empties `byWorkspace`; assert auth-store transition truthy→null triggers clear.
4. **Component test:**
   - Mount inside `QueryClientProvider` + Zustand-rehydrated state.
   - Mock resources to two providers with two models each.
   - Open dropdown, assert grouping labels and item names.
   - Click an item, assert store updated and trigger label changes.
   - Re-mount with empty providers, assert trigger disabled and hint visible.
   - Re-mount with stale selection (not in fixtures), assert trigger shows "Select model" but store keeps prior value.
   - Keyboard: arrow keys traverse, Enter selects, Esc closes.
   - axe: `expect(await axe(container)).toHaveNoViolations()` with dropdown open.
5. **Integration test:**
   - Spin up the WS test client used in `__tests__/ws-client.test.ts`.
   - Seed `chat-model-store` with a selection for the active workspace.
   - Call `sendMessage`, capture the outbound frame, assert `modelHint === "providerId/modelId"`.
   - Repeat with no store selection; assert `modelHint` absent.
   - BR-085: start a streaming response, change `chat-model-store` selection mid-stream, assert no `c.chat.abort` frame is sent and the simulated stream completes normally.
6. Run `pnpm --filter @ai-connect/ui test` and ensure all suites green.

## Success Criteria

- [ ] All five test files green under `pnpm --filter @ai-connect/ui test`.
- [ ] `pnpm --filter @ai-connect/ui typecheck` exits 0.
- [ ] axe-core scan on open dropdown: 0 serious/critical violations.
- [ ] Manual keyboard walk on dev server: open with Enter/Space on focused trigger, ↑/↓ traverse, Enter selects, Esc closes, focus returns to trigger.
- [ ] BR-085 regression test passes (no abort frame on mid-stream model switch).

## Risk Assessment

- **Risk:** Radix `DropdownMenu` exposing `role="menu"` instead of `role="listbox"` may fail the listbox-semantics requirement. **Mitigation:** if axe flags it, switch to Phase 4 Option B (manual Popover + listbox). Test file structure stays the same; only the component implementation changes.
- **Risk:** Test for `useChatSession` requires a real-ish WS — flaky without proper teardown. **Mitigation:** reuse the harness from `__tests__/ws-client.test.ts` (already proven) and call `__testing.teardownSingleton()` after each test.
- **Risk:** Vitest axe matcher not present. **Mitigation:** if `vitest-axe` isn't installed, add it as a devDependency in this phase; alternative is a manual `axe-core` call without the matcher.
