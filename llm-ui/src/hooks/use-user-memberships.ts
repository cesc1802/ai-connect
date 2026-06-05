import * as React from 'react';

import { useWorkspaces } from '@/hooks/use-workspaces';
import { useWsMembers } from '@/hooks/use-ws-members';
import type { Workspace, WorkspaceRole } from '@/schemas/workspace';

export interface UserMembership {
  workspace: Workspace;
  role: WorkspaceRole;
}

// Stable contract: phase 05 (assignment workbench) consumes this same shape.
export function useUserMemberships(userId: string | null): {
  data: UserMembership[];
  isLoading: boolean;
} {
  const workspacesQuery = useWorkspaces();
  const membersQuery = useWsMembers();

  const data = React.useMemo<UserMembership[]>(() => {
    if (!userId) return [];
    const members = membersQuery.data ?? [];
    const workspaces = workspacesQuery.data?.workspaces ?? [];
    const matched = members.filter((m) => m.id === userId);
    if (matched.length === 0 || workspaces.length === 0) return [];
    // Endpoint is current-workspace scoped; pair every match with the first
    // workspace until a multi-workspace members endpoint exists.
    const ws = workspaces[0]!;
    return matched.map((m) => ({ workspace: ws, role: m.role }));
  }, [userId, membersQuery.data, workspacesQuery.data]);

  return {
    data,
    isLoading: workspacesQuery.isLoading || membersQuery.isLoading,
  };
}
