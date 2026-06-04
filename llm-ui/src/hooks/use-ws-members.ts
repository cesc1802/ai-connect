import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  changeWsMemberRole,
  inviteWsMember,
  listWsMembers,
  removeWsMember,
} from '@/api/admin-ws-members';
import type {
  ChangeWsMemberRoleRequest,
  InviteWsMemberRequest,
  WsMemberRow,
} from '@/schemas/admin';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';

export const WS_MEMBERS_QUERY_KEY = ['admin', 'workspace', 'members'] as const;

function makeOptimisticId(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `pending_${rand}`;
}

export function useWsMembers() {
  const query = useQuery<WsMemberRow[]>({
    queryKey: WS_MEMBERS_QUERY_KEY,
    queryFn: async () => {
      const { members } = await listWsMembers();
      return members;
    },
  });

  const adminCount = React.useMemo(
    () => (query.data ?? []).filter((m) => m.role === 'admin').length,
    [query.data],
  );

  return { ...query, adminCount };
}

export function useInviteWsMember() {
  return useOptimisticMutation<InviteWsMemberRequest, WsMemberRow>({
    queryKey: WS_MEMBERS_QUERY_KEY,
    mutationFn: (input) => inviteWsMember(input),
    applyOptimistic: (rows, variables) => [
      ...rows,
      {
        id: makeOptimisticId(),
        email: variables.email,
        role: variables.role,
        joinedAt: new Date().toISOString(),
      },
    ],
    successToast: (row) => `Invited ${row.email}`,
    errorToast: () => 'Could not invite member',
  });
}

interface ChangeRoleVars extends ChangeWsMemberRoleRequest {
  id: string;
}

export function useChangeWsMemberRole() {
  return useOptimisticMutation<ChangeRoleVars, WsMemberRow>({
    queryKey: WS_MEMBERS_QUERY_KEY,
    mutationFn: ({ id, role }) => changeWsMemberRole(id, { role }),
    applyOptimistic: (rows, { id, role }) =>
      rows.map((row) => (row.id === id ? { ...row, role } : row)),
    successToast: (row) => `Updated ${row.email} to ${row.role}`,
    errorToast: () => 'Could not change role',
  });
}

export function useRemoveWsMember() {
  return useOptimisticMutation<{ id: string }, WsMemberRow>({
    queryKey: WS_MEMBERS_QUERY_KEY,
    mutationFn: ({ id }) => removeWsMember(id),
    applyOptimistic: (rows, { id }) => rows.filter((row) => row.id !== id),
    successToast: (row) => `Removed ${row.email}`,
    errorToast: () => 'Could not remove member',
  });
}
