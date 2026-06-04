import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { useStreamingStore } from '@/stores/streaming-store';

/**
 * Predicate matching any cache entry that should be discarded when the active
 * workspace changes. BR-077: switching must purge per-workspace caches and
 * abort the in-flight chat stream. The workspace list itself (`['workspaces',
 * 'list']`) is intentionally preserved so the switcher keeps working.
 */
export function isWorkspaceScopedQueryKey(key: QueryKey): boolean {
  if (!Array.isArray(key) || key.length === 0) return false;
  const [head, second] = key as readonly unknown[];
  if (head === 'conversations') return true;
  if (head === 'admin' && second === 'workspace') return true;
  if (head === 'workspaces' && typeof second === 'string' && second !== 'list') return true;
  return false;
}

export function resetWorkspaceScopedCaches(queryClient: QueryClient): void {
  queryClient.removeQueries({
    predicate: (query) => isWorkspaceScopedQueryKey(query.queryKey),
  });
  useStreamingStore.getState().clear();
}
