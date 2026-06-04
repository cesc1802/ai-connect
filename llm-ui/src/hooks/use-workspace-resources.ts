import { useQuery } from '@tanstack/react-query';
import { listWorkspaceResources } from '@/api/resources';
import type { WorkspaceResourcesResponse } from '@/schemas/resources';

export function workspaceResourcesQueryKey(workspaceId: string) {
  return ['workspaces', workspaceId, 'resources'] as const;
}

export function useWorkspaceResources(workspaceId: string | null) {
  return useQuery<WorkspaceResourcesResponse>({
    queryKey: workspaceResourcesQueryKey(workspaceId ?? ''),
    queryFn: () => listWorkspaceResources(workspaceId!),
    enabled: workspaceId != null,
    refetchOnMount: 'always',
    staleTime: 30_000,
  });
}
