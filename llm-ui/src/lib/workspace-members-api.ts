import { api } from "./api";
import type { OrgRole } from "./workspace-types";
import type { WsRoleKey } from "./mock-data";

// Thin typed wrappers over /workspaces/:id/members. Mutations are
// admin-only server-side; non-admin calls surface as ApiError 403.

export interface WorkspaceMember {
  userId: string;
  username: string;
  wsRoles: WsRoleKey[];
  orgRole: OrgRole;
}

export interface MemberCandidate {
  userId: string;
  username: string;
  orgRole: OrgRole;
}

export function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  return api
    .get<{ members: WorkspaceMember[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/members`)
    .then((r) => r.members);
}

export function listMemberCandidates(workspaceId: string): Promise<MemberCandidate[]> {
  return api
    .get<{ candidates: MemberCandidate[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/members/candidates`)
    .then((r) => r.candidates);
}

export function addMember(workspaceId: string, userId: string, roles: WsRoleKey[]): Promise<void> {
  return api
    .post<unknown>(`/workspaces/${encodeURIComponent(workspaceId)}/members`, { userId, roles })
    .then(() => undefined);
}

export function replaceMemberRoles(workspaceId: string, userId: string, roles: WsRoleKey[]): Promise<void> {
  return api
    .patch<unknown>(
      `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
      { roles },
    )
    .then(() => undefined);
}

export function removeMember(workspaceId: string, userId: string): Promise<void> {
  return api.del<void>(
    `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
  );
}
