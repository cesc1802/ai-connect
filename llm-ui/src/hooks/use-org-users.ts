import { useQuery } from '@tanstack/react-query';

import { listOrgUsers } from '@/api/admin-org-users';
import type { OrgUserRow } from '@/schemas/admin';

export const ORG_USERS_QUERY_KEY = ['admin', 'org', 'users'] as const;

export function useOrgUsers() {
  return useQuery<OrgUserRow[]>({
    queryKey: ORG_USERS_QUERY_KEY,
    queryFn: async () => {
      const { users } = await listOrgUsers();
      return users;
    },
  });
}
