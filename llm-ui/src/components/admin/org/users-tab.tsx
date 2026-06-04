import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  DataTable,
  type DataTableColumn,
  type DataTableState,
} from '@/components/admin/data-table';
import { StatusBadge, type StatusIntent } from '@/components/admin/status-badge';
import { InviteUserDialog } from '@/components/admin/org/invite-user-dialog';
import { DisableUserConfirm } from '@/components/admin/org/disable-user-confirm';
import { useOrgUsers } from '@/hooks/use-org-users';
import { useInviteOrgUser } from '@/hooks/use-invite-org-user';
import { useDisableOrgUser } from '@/hooks/use-disable-org-user';
import type { OrgUserRow, OrgUserStatus } from '@/schemas/admin';

const STATUS_INTENT: Record<OrgUserStatus, StatusIntent> = {
  active: 'active',
  pending: 'pending',
  disabled: 'disabled',
};

const STATUS_LABEL: Record<OrgUserStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  disabled: 'Disabled',
};

function formatJoined(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

export function UsersTab() {
  const { data, isLoading, isError, refetch } = useOrgUsers();
  const rows = React.useMemo(() => data ?? [], [data]);

  const invite = useInviteOrgUser();
  const disable = useDisableOrgUser();

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [disableTarget, setDisableTarget] = React.useState<OrgUserRow | null>(
    null,
  );
  const disableTriggerRef = React.useRef<HTMLButtonElement | null>(null);

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
      disableTriggerRef.current?.focus();
    } catch {
      // errorToast already surfaced by useOptimisticMutation
    }
  }, [disable, disableTarget]);

  const handleDisableOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        setDisableTarget(null);
        disableTriggerRef.current?.focus();
      }
    },
    [],
  );

  const state: DataTableState = isError
    ? 'error'
    : isLoading
      ? 'loading'
      : rows.length === 0
        ? 'empty'
        : 'ready';

  const columns: DataTableColumn<OrgUserRow>[] = React.useMemo(
    () => [
      {
        key: 'email',
        header: 'Email',
        cell: (row) => row.email,
      },
      {
        key: 'status',
        header: 'Status',
        cell: (row) => (
          <StatusBadge intent={STATUS_INTENT[row.status]}>
            {STATUS_LABEL[row.status]}
          </StatusBadge>
        ),
      },
      {
        key: 'joinedAt',
        header: 'Joined',
        cell: (row) => formatJoined(row.joinedAt),
      },
      {
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        cell: (row) => (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={row.status === 'disabled'}
              onClick={(e) => {
                disableTriggerRef.current = e.currentTarget;
                setDisableTarget(row);
              }}
            >
              Disable
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <section
      data-slot="users-tab"
      className="flex flex-col gap-4"
      aria-labelledby="users-tab-heading"
    >
      <header className="flex items-center justify-between gap-4">
        <h2 id="users-tab-heading" className="text-base font-semibold">
          Org users
        </h2>
        <Button
          type="button"
          onClick={() => setInviteOpen(true)}
          data-testid="users-tab-invite-trigger"
        >
          Invite user
        </Button>
      </header>

      <DataTable
        caption="Organization users"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        state={state}
        emptyHeading="No users yet"
        emptyBody="Invite the first user to get started."
        errorMessage="Could not load users."
        onRetry={() => {
          void refetch();
        }}
      />

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={handleInvite}
      />

      <DisableUserConfirm
        open={disableTarget !== null}
        email={disableTarget?.email ?? ''}
        isPending={disable.isPending}
        onOpenChange={handleDisableOpenChange}
        onConfirm={handleConfirmDisable}
      />
    </section>
  );
}

export default UsersTab;
