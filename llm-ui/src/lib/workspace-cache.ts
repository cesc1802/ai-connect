import type { QueryClient } from '@tanstack/react-query';
import { useStreamingStore } from '@/stores/streaming-store';

/**
 * Workspace-scoped query-key prefixes removed when switching workspaces.
 * BR-077: switching active workspace must purge per-workspace caches and
 * abort any in-flight chat stream.
 */
export const WORKSPACE_SCOPED_QUERY_PREFIXES = [
  ['conversations'],
  ['admin', 'workspace', 'templates'],
  ['workspaces'],
] as const;

export function resetWorkspaceScopedCaches(queryClient: QueryClient): void {
  for (const prefix of WORKSPACE_SCOPED_QUERY_PREFIXES) {
    queryClient.removeQueries({ queryKey: prefix as unknown as readonly unknown[] });
  }
  useStreamingStore.getState().clear();
}
