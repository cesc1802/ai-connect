import { disableOrgUser } from '@/api/admin-org-users';
import type { OrgUserRow } from '@/schemas/admin';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { ORG_USERS_QUERY_KEY } from '@/hooks/use-org-users';

export function useDisableOrgUser() {
  return useOptimisticMutation<{ id: string }, OrgUserRow>({
    queryKey: ORG_USERS_QUERY_KEY,
    mutationFn: ({ id }) => disableOrgUser(id),
    applyOptimistic: (rows, { id }) =>
      rows.map((row) =>
        row.id === id ? { ...row, status: 'disabled' } : row,
      ),
    successToast: (row) => `Disabled ${row.email}`,
    errorToast: () => 'Could not disable user',
  });
}
