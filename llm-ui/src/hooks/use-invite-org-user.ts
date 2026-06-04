import { inviteOrgUser } from '@/api/admin-org-users';
import type { InviteOrgUserRequest, OrgUserRow } from '@/schemas/admin';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { ORG_USERS_QUERY_KEY } from '@/hooks/use-org-users';

function makeOptimisticId(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `pending_${rand}`;
}

export function useInviteOrgUser() {
  return useOptimisticMutation<InviteOrgUserRequest, OrgUserRow>({
    queryKey: ORG_USERS_QUERY_KEY,
    mutationFn: (input) => inviteOrgUser(input),
    applyOptimistic: (rows, variables) => [
      ...rows,
      {
        id: makeOptimisticId(),
        email: variables.email,
        status: 'pending',
        joinedAt: new Date().toISOString(),
      },
    ],
    successToast: (row) => `Invited ${row.email}`,
  });
}
