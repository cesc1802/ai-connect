import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DataTable,
  type DataTableColumn,
  type DataTableState,
} from '@/components/admin/data-table';
import { InviteMemberDialog } from './invite-member-dialog';
import { ChangeRoleConfirm } from './change-role-confirm';
import { RemoveMemberConfirm } from './remove-member-confirm';
import {
  useWsMembers,
  useInviteWsMember,
  useChangeWsMemberRole,
  useRemoveWsMember,
} from '@/hooks/use-ws-members';
import { useSessionUser } from '@/stores/auth-store';
import type { WsMemberRow, InviteWsMemberRequest } from '@/schemas/admin';
import { WorkspaceRole } from '@/schemas/auth';

const ROLE_OPTIONS: { value: WorkspaceRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
];

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

const LAST_ADMIN_TOOLTIP =
  'A workspace must always have at least one Admin.';

function formatJoined(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

interface PendingRoleChange {
  member: WsMemberRow;
  toRole: WorkspaceRole;
}

export function MembersTab() {
  const navigate = useNavigate();
  const sessionUser = useSessionUser();
  const { data, isLoading, isError, refetch, adminCount } = useWsMembers();
  const rows = React.useMemo(() => data ?? [], [data]);

  const invite = useInviteWsMember();
  const changeRole = useChangeWsMemberRole();
  const remove = useRemoveWsMember();

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [pendingChange, setPendingChange] =
    React.useState<PendingRoleChange | null>(null);
  const [removeTarget, setRemoveTarget] = React.useState<WsMemberRow | null>(
    null,
  );
  const removeTriggerRef = React.useRef<HTMLButtonElement | null>(null);

  const handleInvite = React.useCallback(
    async (values: InviteWsMemberRequest) => {
      await invite.mutateAsync(values);
    },
    [invite],
  );

  const applyRoleChange = React.useCallback(
    async (member: WsMemberRow, toRole: WorkspaceRole) => {
      const isSelf = sessionUser?.id === member.id;
      try {
        await changeRole.mutateAsync({ id: member.id, role: toRole });
        if (isSelf && toRole !== 'admin') {
          void navigate({ to: '/chat' });
        }
      } catch {
        // errorToast surfaced by useOptimisticMutation
      }
    },
    [changeRole, navigate, sessionUser?.id],
  );

  const handleRoleSelect = React.useCallback(
    (member: WsMemberRow, nextRole: WorkspaceRole) => {
      if (nextRole === member.role) return;
      if (member.role === 'admin' && nextRole !== 'admin') {
        setPendingChange({ member, toRole: nextRole });
        return;
      }
      void applyRoleChange(member, nextRole);
    },
    [applyRoleChange],
  );

  const handleConfirmChange = React.useCallback(async () => {
    if (!pendingChange) return;
    await applyRoleChange(pendingChange.member, pendingChange.toRole);
    setPendingChange(null);
  }, [applyRoleChange, pendingChange]);

  const handleConfirmRemove = React.useCallback(async () => {
    if (!removeTarget) return;
    const isSelf = sessionUser?.id === removeTarget.id;
    try {
      await remove.mutateAsync({ id: removeTarget.id });
      setRemoveTarget(null);
      removeTriggerRef.current?.focus();
      if (isSelf) void navigate({ to: '/chat' });
    } catch {
      // errorToast surfaced by useOptimisticMutation
    }
  }, [navigate, remove, removeTarget, sessionUser?.id]);

  const handleRemoveOpenChange = React.useCallback((open: boolean) => {
    if (!open) {
      setRemoveTarget(null);
      removeTriggerRef.current?.focus();
    }
  }, []);

  const state: DataTableState = isError
    ? 'error'
    : isLoading
      ? 'loading'
      : rows.length === 0
        ? 'empty'
        : 'ready';

  const columns: DataTableColumn<WsMemberRow>[] = React.useMemo(
    () => [
      {
        key: 'email',
        header: 'Email',
        cell: (row) => row.email,
      },
      {
        key: 'role',
        header: 'Role',
        cell: (row) => {
          const isLastAdmin = row.role === 'admin' && adminCount <= 1;
          if (row.role === 'owner') {
            return <span className="text-sm">{ROLE_LABEL.owner}</span>;
          }
          const trigger = (
            <SelectTrigger
              className="w-[140px]"
              aria-label={`Change role for ${row.email}`}
              disabled={isLastAdmin}
            >
              <SelectValue />
            </SelectTrigger>
          );
          return (
            <Select
              value={row.role}
              onValueChange={(value) =>
                handleRoleSelect(row, value as WorkspaceRole)
              }
            >
              {isLastAdmin ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>{trigger}</span>
                  </TooltipTrigger>
                  <TooltipContent>{LAST_ADMIN_TOOLTIP}</TooltipContent>
                </Tooltip>
              ) : (
                trigger
              )}
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        key: 'joinedAt',
        header: 'Joined',
        cell: (row) => formatJoined(row.joinedAt),
      },
      {
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        cell: (row) => {
          if (row.role === 'owner') {
            return <span className="sr-only">Owner cannot be removed</span>;
          }
          const isLastAdmin = row.role === 'admin' && adminCount <= 1;
          const button = (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isLastAdmin}
              onClick={(e) => {
                removeTriggerRef.current = e.currentTarget;
                setRemoveTarget(row);
              }}
              data-testid={`members-tab-remove-${row.id}`}
            >
              Remove
            </Button>
          );
          return (
            <div className="flex justify-end">
              {isLastAdmin ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>{button}</span>
                  </TooltipTrigger>
                  <TooltipContent>{LAST_ADMIN_TOOLTIP}</TooltipContent>
                </Tooltip>
              ) : (
                button
              )}
            </div>
          );
        },
      },
    ],
    [adminCount, handleRoleSelect],
  );

  return (
    <TooltipProvider delayDuration={200}>
    <section
      data-slot="members-tab"
      className="flex flex-col gap-4"
      aria-labelledby="members-tab-heading"
    >
      <header className="flex items-center justify-between gap-4">
        <h2 id="members-tab-heading" className="text-base font-semibold">
          Workspace members
        </h2>
        <Button
          type="button"
          onClick={() => setInviteOpen(true)}
          data-testid="members-tab-invite-trigger"
        >
          Invite member
        </Button>
      </header>

      <DataTable
        caption="Workspace members"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        state={state}
        emptyHeading="No members yet"
        emptyBody="Invite the first member to get started."
        errorMessage="Could not load members."
        onRetry={() => {
          void refetch();
        }}
      />

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={handleInvite}
      />

      {pendingChange ? (
        <ChangeRoleConfirm
          open
          onOpenChange={(open) => {
            if (!open) setPendingChange(null);
          }}
          email={pendingChange.member.email}
          fromRole={pendingChange.member.role}
          toRole={pendingChange.toRole}
          isSelf={sessionUser?.id === pendingChange.member.id}
          onConfirm={handleConfirmChange}
        />
      ) : null}

      <RemoveMemberConfirm
        open={removeTarget !== null}
        email={removeTarget?.email ?? ''}
        isSelf={sessionUser?.id === removeTarget?.id}
        isPending={remove.isPending}
        onOpenChange={handleRemoveOpenChange}
        onConfirm={handleConfirmRemove}
      />
    </section>
    </TooltipProvider>
  );
}

export default MembersTab;
