import * as React from 'react';

import { useOrgUsers } from '@/hooks/use-org-users';
import { useWorkspaces } from '@/hooks/use-workspaces';
import type { OrgUserRow } from '@/schemas/admin';
import type { Workspace, WorkspaceRole } from '@/schemas/workspace';

const ROLES: readonly WorkspaceRole[] = [
  'owner',
  'admin',
  'member',
  'viewer',
] as const;

// Deterministic FNV-1a 32-bit hash over a string.
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h;
}

// Derive a membership role from (userId, workspaceId). 1 in 4 pairs have
// no membership ("—" cell). Stable across renders.
function deriveRole(
  userId: string,
  workspaceId: string,
): WorkspaceRole | null {
  const h = hash(`${userId}::${workspaceId}`);
  if (h % 4 === 0) return null;
  return ROLES[h % ROLES.length] ?? 'member';
}

export interface OrgMembershipMatrix {
  users: OrgUserRow[];
  workspaces: Workspace[];
  get: (userId: string, workspaceId: string) => WorkspaceRole | null;
  isLoading: boolean;
  isError: boolean;
}

export function useOrgMembershipMatrix(): OrgMembershipMatrix {
  const usersQuery = useOrgUsers();
  const workspacesQuery = useWorkspaces();

  const users = usersQuery.data ?? [];
  const workspaces = workspacesQuery.data?.workspaces ?? [];

  const index = React.useMemo(() => {
    const map = new Map<string, WorkspaceRole | null>();
    for (const u of users) {
      for (const ws of workspaces) {
        map.set(`${u.id}::${ws.id}`, deriveRole(u.id, ws.id));
      }
    }
    return map;
  }, [users, workspaces]);

  const get = React.useCallback(
    (userId: string, workspaceId: string): WorkspaceRole | null => {
      return index.get(`${userId}::${workspaceId}`) ?? null;
    },
    [index],
  );

  return {
    users,
    workspaces,
    get,
    isLoading: usersQuery.isLoading || workspacesQuery.isLoading,
    isError: usersQuery.isError || workspacesQuery.isError,
  };
}
