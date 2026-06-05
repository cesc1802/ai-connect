import * as React from 'react';

import { AdminConsoleShell } from '@/components/admin/admin-console-shell';
import { MatrixTable } from '@/components/rbac/matrix/matrix-table';
import { MatrixToolbar } from '@/components/rbac/matrix/matrix-toolbar';
import { RoleBadge } from '@/components/rbac/role-badge';
import { useOrgMembershipMatrix } from '@/hooks/use-org-membership-matrix';
import type { WorkspaceRole } from '@/schemas/workspace';

const LEGEND_ROLES: readonly WorkspaceRole[] = [
  'owner',
  'admin',
  'member',
  'viewer',
] as const;

export function AccessMatrixPage() {
  const { users, workspaces, get, isLoading, isError } =
    useOrgMembershipMatrix();

  const [search, setSearch] = React.useState('');
  const [selectedWsIds, setSelectedWsIds] = React.useState<string[]>([]);

  // Default selection: all workspaces once loaded.
  React.useEffect(() => {
    if (workspaces.length > 0 && selectedWsIds.length === 0) {
      setSelectedWsIds(workspaces.map((w) => w.id));
    }
  }, [workspaces, selectedWsIds.length]);

  const filteredUsers = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.email.toLowerCase().includes(q));
  }, [users, search]);

  const filteredWorkspaces = React.useMemo(() => {
    if (selectedWsIds.length === 0) return workspaces;
    const set = new Set(selectedWsIds);
    return workspaces.filter((w) => set.has(w.id));
  }, [workspaces, selectedWsIds]);

  return (
    <AdminConsoleShell
      title="Ma trận phân quyền"
      headingId="access-matrix-heading"
      description="Một dòng cho mỗi người, một cột cho mỗi workspace. Thấy ngay ai giữ vai trò gì, ở đâu."
    >
      <div
        data-slot="matrix-legend"
        className="bg-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3"
      >
        <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
          Chú thích vai trò
        </span>
        {LEGEND_ROLES.map((role) => (
          <RoleBadge key={role} role={role} />
        ))}
      </div>

      <MatrixToolbar
        search={search}
        onSearchChange={setSearch}
        workspaces={workspaces}
        selectedWorkspaceIds={selectedWsIds}
        onSelectedWorkspaceIdsChange={setSelectedWsIds}
      />

      {isError ? (
        <div
          data-slot="matrix-error"
          role="alert"
          className="bg-destructive/10 text-destructive rounded-lg border p-4 text-sm"
        >
          Không tải được dữ liệu ma trận.
        </div>
      ) : isLoading ? (
        <div
          data-slot="matrix-loading"
          aria-busy="true"
          className="text-muted-foreground rounded-lg border p-6 text-center text-sm"
        >
          Đang tải…
        </div>
      ) : filteredUsers.length === 0 || filteredWorkspaces.length === 0 ? (
        <div
          data-slot="matrix-empty"
          className="text-muted-foreground rounded-lg border p-6 text-center text-sm"
        >
          Không có kết quả phù hợp.
        </div>
      ) : (
        <MatrixTable
          users={filteredUsers}
          workspaces={filteredWorkspaces}
          getRole={get}
        />
      )}
    </AdminConsoleShell>
  );
}
