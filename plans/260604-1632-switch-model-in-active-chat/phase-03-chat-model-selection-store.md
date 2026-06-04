---
phase: 3
title: "Chat Model Selection Store"
status: pending
priority: P2
effort: "1.5h"
dependencies: [1]
---

# Phase 3: Chat Model Selection Store

## Overview

Zustand store that records the user's chosen `(providerId, modelId)` per workspace. Mirrors UC-021 main flow step 4 ("System updates the Zustand chat slice with the new `(providerId, modelId)`") and survives reloads so users keep their preference.

## Requirements

- **Functional:** Per-workspace selection persisted across reloads. Selector reads + setter writes. Clearing selection on logout (matches existing auth-store teardown).
- **Non-functional:** Co-located with other Zustand stores (`llm-ui/src/stores/`), follows existing persist pattern from `active-workspace-store.ts`.

## Architecture

`llm-ui/src/stores/chat-model-store.ts`:

```ts
type ChatModelSelection = { providerId: string; modelId: string };

type ChatModelState = {
  byWorkspace: Record<string, ChatModelSelection>;
  setModel: (workspaceId: string, sel: ChatModelSelection) => void;
  getModel: (workspaceId: string) => ChatModelSelection | null;
  clearAll: () => void;
};
```

Use `persist` middleware, `localStorage`, key `chat-model-selection`. Subscribe to `useAuthStore` access-token transition to null and call `clearAll()` (parallel to `teardownSingleton` in `use-chat-session.ts`).

Convenience hook `useActiveChatModel()` reads the active workspace id from `useActiveWorkspaceStore` and returns the current selection (or `null` if unset).

## Related Code Files

- Create: `llm-ui/src/stores/chat-model-store.ts`
- Create: `llm-ui/src/hooks/use-active-chat-model.ts`

## Implementation Steps

1. Create `stores/chat-model-store.ts` with Zustand + `persist`. Partialize `{ byWorkspace }` only (functions are derived).
2. Implement `setModel`, `getModel`, `clearAll`.
3. Subscribe once (at module bottom) to `useAuthStore` for `accessToken` transitions from truthy → null; call `clearAll()`.
4. Create `hooks/use-active-chat-model.ts` exporting `useActiveChatModel()` that returns `{ selection, setSelection }` for the currently active workspace.
5. Run `pnpm --filter @ai-connect/ui typecheck`.

## Success Criteria

- [ ] Selection persists across reload for a given workspace id.
- [ ] Switching active workspace does not leak the previous workspace's selection.
- [ ] Logout clears all selections.
- [ ] `pnpm --filter @ai-connect/ui typecheck` exits 0.

## Risk Assessment

- **Risk:** Stored model references a provider that has since been disabled or removed. **Mitigation:** the selector component (Phase 4) cross-checks the persisted selection against the resources hook; if missing, it displays "—" and the next send omits `modelHint`.
- **Risk:** Auth-store subscription leaks. **Mitigation:** single module-level subscription, matches the singleton pattern in `use-chat-session.ts`. No teardown needed since the store outlives the app.
