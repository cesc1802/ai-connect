import { useQuery } from '@tanstack/react-query';
import { listWorkspaces } from '@/api/workspaces';
import type { WorkspaceListResponse } from '@/schemas/workspace';

export const workspacesQueryKey = ['workspaces', 'list'] as const;

export function useWorkspaces() {
  return useQuery<WorkspaceListResponse>({
    queryKey: workspacesQueryKey,
    queryFn: () => listWorkspaces(),
  });
}
