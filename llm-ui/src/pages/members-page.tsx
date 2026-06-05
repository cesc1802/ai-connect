import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { InviteUserDialog } from '@/components/admin/org/invite-user-dialog';
import { DisableUserConfirm } from '@/components/admin/org/disable-user-confirm';
import {
  MembersToolbar,
  type MembersStatusFilter,
} from '@/components/rbac/members/members-toolbar';
import {
  MembersTable,
  type MembersTableState,
} from '@/components/rbac/members/members-table';
import { MemberDetailDrawer } from '@/components/rbac/members/member-detail-drawer';
import { useOrgUsers } from '@/hooks/use-org-users';
import { useInviteOrgUser } from '@/hooks/use-invite-org-user';
import { useDisableOrgUser } from '@/hooks/use-disable-org-user';
import type { OrgUserRow } from '@/schemas/admin';

export function MembersPage() {
  const usersQuery = useOrgUsers();
  const invite = useInviteOrgUser();
  const disable = useDisableOrgUser();

  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState<MembersStatusFilter>('all');
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<OrgUserRow | null>(null);
  const [disableTarget, setDisableTarget] = React.useState<OrgUserRow | null>(
    null,
  );

  const rows = React.useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const filteredRows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== 'all' && row.status !== status) return false;
      if (q && !row.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, status]);

  const state: MembersTableState = usersQuery.isError
    ? 'error'
    : usersQuery.isLoading
      ? 'loading'
      : filteredRows.length === 0
        ? 'empty'
        : 'ready';

  const handleInvite = React.useCallback(
    async (values: { email: string }) => {
      await invite.mutateAsync(values);
    },
    [invite],
  );

  const handleConfirmDisable = React.useCallback(async () => {
    if (!disableTarget) return;
    try {
      await disable.mutateAsync({ id: disableTarget.id });
      setDisableTarget(null);
      setSelected(null);
    } catch {
      // toast surfaced by useOptimisticMutation
    }
  }, [disable, disableTarget]);

  const handleDrawerOpenChange = React.useCallback((open: boolean) => {
    if (!open) setSelected(null);
  }, []);

  return (
    <div
      data-slot="members-page"
      className="flex flex-col gap-6 p-4 sm:p-6"
    >
      <PageHeader
        title="Thành viên"
        subtitle="Pool người dùng dùng chung toàn tổ chức. Vai trò org quyết định quyền quản trị nền tảng."
        headingId="members-page-heading"
      />

      <MembersToolbar
        query={query}
        status={status}
        onQueryChange={setQuery}
        onStatusChange={setStatus}
        onInviteClick={() => setInviteOpen(true)}
      />

      <MembersTable
        rows={filteredRows}
        state={state}
        onRowOpen={setSelected}
        onRetry={() => {
          void usersQuery.refetch();
        }}
      />

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={handleInvite}
      />

      <MemberDetailDrawer
        user={selected}
        onOpenChange={handleDrawerOpenChange}
        onDisableClick={(row) => setDisableTarget(row)}
      />

      <DisableUserConfirm
        open={disableTarget !== null}
        email={disableTarget?.email ?? ''}
        isPending={disable.isPending}
        onOpenChange={(open) => {
          if (!open) setDisableTarget(null);
        }}
        onConfirm={handleConfirmDisable}
      />
    </div>
  );
}

export default MembersPage;
