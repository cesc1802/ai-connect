---
phase: 4
title: "Model Selector Component"
status: pending
priority: P2
effort: "3h"
dependencies: [2, 3]
---

# Phase 4: Model Selector Component

## Overview

Build `ModelSelector` — a presentational dropdown that lists workspace-scoped, role-filtered, enabled models grouped by provider, with full keyboard support and listbox semantics. Wires `useWorkspaceResources` (data) to `chat-model-store` (selection).

## Requirements

- **Functional:** Render a button showing the current model name (or "Select model"); on open, render a grouped list (group label = provider display name, items = models). Selecting an item closes the dropdown and writes to the store (UC-021 steps 1-5). Disabled empty state per A1.
- **Non-functional:** WCAG 2.1 AA (NFR-016) via `role="listbox"`, `role="option"`, `aria-activedescendant`. Keyboard nav per NFR-017: ↑/↓ traverse, Enter selects, Esc closes, Home/End jump to ends.

## Architecture

`llm-ui/src/components/chat/model-selector.tsx` — built on shadcn `DropdownMenu` (`llm-ui/src/components/ui/dropdown-menu.tsx` already exists). Use `DropdownMenuGroup` + `DropdownMenuLabel` for provider grouping; `DropdownMenuRadioGroup` + `DropdownMenuRadioItem` for selection semantics (Radix sets `role="menuitemradio"` natively).

Radix `DropdownMenu` defaults to `role="menu"` rather than `role="listbox"`. UC-021 Notes explicitly require listbox semantics. Two options:

- **Option A (preferred):** override the trigger/content `role` attributes via `asChild` slot to expose `role="listbox"` / `role="option"` (Radix permits `role` override at the leaf). Verify with axe-core in Phase 6.
- **Option B (fallback):** swap to a hand-rolled listbox using shadcn `Popover` + manual `aria-activedescendant` state. Use only if Option A fails axe.

Decide in Phase 4 based on axe output; pick Option A first since it reuses existing primitives.

Component shape:

```tsx
type ModelSelectorProps = { className?: string };

export function ModelSelector({ className }: ModelSelectorProps) {
  const workspaceId = useActiveWorkspaceStore((s) => s.activeWorkspaceId);
  const { data, isLoading } = useWorkspaceResources(workspaceId);
  const { selection, setSelection } = useActiveChatModel();
  // ... derive currentLabel, providers list, handlers
}
```

Display rules:

- Loading: trigger shows `…`; dropdown disabled.
- Empty (A1): trigger disabled with title/hint "No models available — ask an admin to assign a provider."
- Stale selection (selected model not in current list): trigger shows "Select model"; do NOT auto-clear the store (the user may switch workspaces back).

## Related Code Files

- Create: `llm-ui/src/components/chat/model-selector.tsx`
- Read for reuse: `llm-ui/src/components/ui/dropdown-menu.tsx`

## Implementation Steps

1. Create `model-selector.tsx`. Read `workspaceId`, resources, current selection.
2. Compute `currentLabel`: if selection matches a model in `data.providers`, show `${provider.displayName} · ${model.displayName}`; else `"Select model"`.
3. Trigger: `<Button variant="outline" size="sm" disabled={isEmpty}>`. Disabled state when `!isLoading && providers.length === 0`.
4. Content: iterate `data.providers`, render `<DropdownMenuLabel>{provider.displayName}</DropdownMenuLabel>` then a `DropdownMenuRadioGroup` of the provider's models. On `onValueChange`, parse the `providerId/modelId` value and call `setSelection`.
5. Apply `role="listbox"` to content via `asChild` slot; `role="option"` to each item.
6. Wire keyboard: Radix already covers arrow/Enter/Esc; verify Home/End behavior matches a listbox (may need a `onKeyDown` adapter).
7. Empty-state message rendered inside dropdown when open and `providers.length === 0` AND not loading.
8. Run `pnpm --filter @ai-connect/ui typecheck`.

## Success Criteria

- [ ] Trigger button shows current model name; defaults to "Select model" when unset.
- [ ] Dropdown groups items by provider; only enabled, role-allowed providers shown (driven by Phase 1 filtering).
- [ ] Selecting an item updates the Zustand store and closes the dropdown.
- [ ] Disabled empty state shows correct hint when no providers available.
- [ ] Keyboard ↑/↓/Enter/Esc work; manual axe-core check on the trigger + open dropdown returns no serious/critical violations.
- [ ] `pnpm --filter @ai-connect/ui typecheck` exits 0.

## Risk Assessment

- **Risk:** Radix `DropdownMenu` may resist `role` override. **Mitigation:** documented Option B fallback (Popover + manual a11y). Decision deferred to axe outcome in Phase 6.
- **Risk:** Provider grouping with many models becomes long. **Mitigation:** wrap content in shadcn `ScrollArea` with `max-h-80`; reuses `components/ui/scroll-area.tsx`.
- **Risk:** Provider disabled between dropdown open and selection (A2). **Mitigation:** on `onValueChange`, re-validate the chosen `(providerId, modelId)` against the current TanStack Query cache; if missing, show a toast (`sonner` already wired) and keep the prior selection.
