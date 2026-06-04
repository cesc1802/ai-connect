---
phase: 2
title: "Workspace Resources Hook"
status: pending
priority: P2
effort: "1h"
dependencies: [1]
---

# Phase 2: Workspace Resources Hook

## Overview

Add a TanStack Query hook that fetches the workspace resources, Zod-parses the response, and exposes loading/error/data states to consumers. Keyed by `workspaceId` so switching workspaces refetches.

## Requirements

- **Functional:** `useWorkspaceResources(workspaceId)` returns providers+models for the active workspace.
- **Non-functional:** Zod-parsed at API boundary (NFR-021). Refetch on mount to address UC-021 A2 (provider disabled between open and select).

## Architecture

- `llm-ui/src/api/resources.ts` — `listWorkspaceResources(workspaceId)` thin fetch helper, parallels `api/workspaces.ts`.
- `llm-ui/src/hooks/use-workspace-resources.ts` — `useQuery` wrapper, keyed `['workspaces', workspaceId, 'resources']`.

```ts
// api/resources.ts
export async function listWorkspaceResources(workspaceId: string) {
  return apiFetch(`/workspaces/${workspaceId}/resources`, { method: 'GET' }, WorkspaceResourcesResponse);
}
```

```ts
// hooks/use-workspace-resources.ts
export function useWorkspaceResources(workspaceId: string | null) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'resources'] as const,
    queryFn: () => listWorkspaceResources(workspaceId!),
    enabled: workspaceId != null,
    refetchOnMount: 'always',
    staleTime: 30_000,
  });
}
```

## Related Code Files

- Create: `llm-ui/src/api/resources.ts`
- Create: `llm-ui/src/hooks/use-workspace-resources.ts`

## Implementation Steps

1. Create `api/resources.ts` with `listWorkspaceResources`. Reuse `apiFetch` (same pattern as `api/workspaces.ts`).
2. Create `hooks/use-workspace-resources.ts` exporting `useWorkspaceResources`.
3. Wire `enabled` to `workspaceId != null` so the query is idle until a workspace is active.
4. Set `staleTime: 30_000` and `refetchOnMount: 'always'` so reopening the dropdown re-validates without spamming the server during continuous typing.
5. Run `pnpm --filter @ai-connect/ui typecheck`.

## Success Criteria

- [ ] Hook returns `{ data, isLoading, error }` typed against `WorkspaceResourcesResponse`.
- [ ] Switching `workspaceId` triggers a refetch (TanStack Query handles this via key change).
- [ ] Hook is idle when `workspaceId == null` (no fetch).
- [ ] `pnpm --filter @ai-connect/ui typecheck` exits 0.

## Risk Assessment

- **Risk:** Over-fetching on every dropdown open. **Mitigation:** `staleTime: 30s` covers normal usage; `refetchOnMount: 'always'` only re-runs when the component remounts, which is when the dropdown opens via shadcn's portal mount.
- **Risk:** Hook usage outside the `QueryClientProvider`. **Mitigation:** mirror existing pattern from `use-conversations.ts`, which is already wrapped by `App.tsx`.
