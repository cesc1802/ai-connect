import type { OrgUserRow } from '@/schemas/admin';
import type { Workspace, WorkspaceRole } from '@/schemas/workspace';

export interface OrgRoleStat {
  role: WorkspaceRole;
  label: string;
  description: string;
  count: number;
  members: { id: string; label: string }[];
}

const ROLE_ORDER: WorkspaceRole[] = ['owner', 'admin', 'member', 'viewer'];

const ROLE_META: Record<
  WorkspaceRole,
  { label: string; description: string }
> = {
  owner: {
    label: 'Owner',
    description: 'Toàn quyền kiểm soát workspace',
  },
  admin: {
    label: 'Admin',
    description: 'Quản lý thành viên và cấu hình workspace',
  },
  member: {
    label: 'Member',
    description: 'Cộng tác viên — sử dụng tài nguyên workspace',
  },
  viewer: {
    label: 'Viewer',
    description: 'Chỉ xem — không chỉnh sửa',
  },
};

function labelFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Bucket org users into role groups using the viewer-visible workspace roles.
 * Each user is assigned the highest role they hold across all workspaces;
 * disabled users are excluded. Returns groups in canonical role order.
 */
export function deriveOrgRoleStats(
  users: readonly OrgUserRow[],
  workspaces: readonly Workspace[],
): OrgRoleStat[] {
  const buckets = new Map<WorkspaceRole, { id: string; label: string }[]>();
  for (const role of ROLE_ORDER) buckets.set(role, []);

  const roleRank: Record<WorkspaceRole, number> = {
    owner: 0,
    admin: 1,
    member: 2,
    viewer: 3,
  };

  const wsRoleByIndex = workspaces.map((w) => w.role);
  const fallbackRole: WorkspaceRole = wsRoleByIndex[0] ?? 'member';

  for (const user of users) {
    if (user.status === 'disabled') continue;
    const assigned = wsRoleByIndex.reduce<WorkspaceRole>(
      (best, current) =>
        roleRank[current] < roleRank[best] ? current : best,
      fallbackRole,
    );
    buckets.get(assigned)!.push({ id: user.id, label: labelFromEmail(user.email) });
  }

  return ROLE_ORDER.map((role) => {
    const members = buckets.get(role)!;
    return {
      role,
      label: ROLE_META[role].label,
      description: ROLE_META[role].description,
      count: members.length,
      members,
    };
  });
}
