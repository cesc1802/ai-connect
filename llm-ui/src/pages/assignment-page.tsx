import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { MemberRail } from '@/components/rbac/assignment/member-rail';
import {
  MemberWorkspaceAssignments,
  type WorkspaceAssignment,
} from '@/components/rbac/assignment/member-workspace-assignments';
import { AssignToWorkspaceDialog } from '@/components/rbac/assignment/assign-to-workspace-dialog';
import { OwnerNoteCallout } from '@/components/rbac/assignment/owner-note-callout';
import { ChangeRoleConfirm } from '@/components/admin/workspace/change-role-confirm';
import { RemoveMemberConfirm } from '@/components/admin/workspace/remove-member-confirm';
import { useOrgUsers } from '@/hooks/use-org-users';
import { useOrgMembershipMatrix } from '@/hooks/use-org-membership-matrix';
import { useInviteWsMember, useChangeWsMemberRole, useRemoveWsMember } from '@/hooks/use-ws-members';
import type { OrgUserRow } from '@/schemas/admin';
import type { WorkspaceRole } from '@/schemas/workspace';

const ROLE_ROTATE: WorkspaceRole[] = ['owner', 'admin', 'member', 'viewer'];

function nextRole(current: WorkspaceRole): WorkspaceRole {
  const i = ROLE_ROTATE.indexOf(current);
  return ROLE_ROTATE[(i + 1) % ROLE_ROTATE.length]!;
}

export function AssignmentPage() {
  const usersQuery = useOrgUsers();
  const matrix = useOrgMembershipMatrix();
  const invite = useInviteWsMember();
  const changeRole = useChangeWsMemberRole();
  const remove = useRemoveWsMember();

  const [query, setQuery] = React.useState('');
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(
    null,
  );
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [changeTarget, setChangeTarget] = React.useState<WorkspaceAssignment | null>(null);
  const [removeTarget, setRemoveTarget] = React.useState<WorkspaceAssignment | null>(null);

  const users = usersQuery.data ?? [];

  React.useEffect(() => {
    if (!selectedUserId && users.length > 0) {
      setSelectedUserId(users[0]!.id);
    }
  }, [users, selectedUserId]);

  const selectedUser: OrgUserRow | null = React.useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  // Per-user workspace assignments derived from matrix (cross-workspace source).
  const assignmentsByUser = React.useMemo(() => {
    const map = new Map<string, WorkspaceAssignment[]>();
    for (const u of matrix.users) {
      const rows: WorkspaceAssignment[] = [];
      for (const ws of matrix.workspaces) {
        const role = matrix.get(u.id, ws.id);
        if (role) rows.push({ workspace: ws, role });
      }
      map.set(u.id, rows);
    }
    return map;
  }, [matrix]);

  const assignmentCounts = React.useMemo(() => {
    const m = new Map<string, number>();
    assignmentsByUser.forEach((rows, id) => m.set(id, rows.length));
    return m;
  }, [assignmentsByUser]);

  const currentAssignments = selectedUserId
    ? (assignmentsByUser.get(selectedUserId) ?? [])
    : [];

  const takenIds = new Set(currentAssignments.map((a) => a.workspace.id));
  const availableWorkspaces = matrix.workspaces.filter(
    (w) => !takenIds.has(w.id),
  );

  const handleAssign = async (workspaceId: string, role: WorkspaceRole) => {
    if (!selectedUser) return;
    try {
      await invite.mutateAsync({ email: selectedUser.email, role });
      setAssignOpen(false);
    } catch {
      // toast handled by useOptimisticMutation
    }
    void workspaceId;
  };

  const handleChangeRole = async () => {
    if (!changeTarget || !selectedUserId) return;
    try {
      await changeRole.mutateAsync({
        id: selectedUserId,
        role: nextRole(changeTarget.role),
      });
      setChangeTarget(null);
    } catch {
      // toast handled
    }
  };

  const handleRemove = async () => {
    if (!removeTarget || !selectedUserId) return;
    try {
      await remove.mutateAsync({ id: selectedUserId });
      setRemoveTarget(null);
    } catch {
      // toast handled
    }
  };

  return (
    <div
      data-slot="assignment-page"
      className="flex h-full flex-col"
    >
      <div className="border-b px-4 py-4 sm:px-6">
        <PageHeader
          title="Phân quyền người dùng"
          subtitle="Org Owner gán thành viên vào workspace và đặt vai trò cho từng người."
          headingId="assignment-page-heading"
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_1fr]">
        <MemberRail
          users={users}
          selectedUserId={selectedUserId}
          onSelect={setSelectedUserId}
          query={query}
          onQueryChange={setQuery}
          assignmentCounts={assignmentCounts}
          isLoading={usersQuery.isLoading}
        />

        <div className="min-w-0 overflow-y-auto">
          <MemberWorkspaceAssignments
            user={selectedUser}
            assignments={currentAssignments}
            isLoading={matrix.isLoading}
            onAssignClick={() => setAssignOpen(true)}
            onChangeRole={setChangeTarget}
            onRemove={setRemoveTarget}
          />

          {selectedUser && <OwnerNoteCallout />}
        </div>
      </div>

      <AssignToWorkspaceDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        userLabel={selectedUser?.email ?? ''}
        availableWorkspaces={availableWorkspaces}
        isSubmitting={invite.isPending}
        onSubmit={handleAssign}
      />

      {changeTarget && selectedUser && (
        <ChangeRoleConfirm
          open={changeTarget !== null}
          onOpenChange={(open) => {
            if (!open) setChangeTarget(null);
          }}
          email={selectedUser.email}
          fromRole={changeTarget.role}
          toRole={nextRole(changeTarget.role)}
          isSelf={false}
          onConfirm={handleChangeRole}
        />
      )}

      {removeTarget && selectedUser && (
        <RemoveMemberConfirm
          open={removeTarget !== null}
          email={selectedUser.email}
          isSelf={false}
          isPending={remove.isPending}
          onOpenChange={(open) => {
            if (!open) setRemoveTarget(null);
          }}
          onConfirm={handleRemove}
        />
      )}
    </div>
  );
}

export default AssignmentPage;
