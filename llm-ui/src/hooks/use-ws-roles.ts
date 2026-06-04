import { useQuery } from '@tanstack/react-query';

import { listWsRoles } from '@/api/admin-ws-roles';
import type { WsRoleCatalogueEntry } from '@/schemas/admin';

export const WS_ROLES_QUERY_KEY = ['admin', 'workspace', 'roles'] as const;

export function useWsRoles() {
  return useQuery<WsRoleCatalogueEntry[]>({
    queryKey: WS_ROLES_QUERY_KEY,
    queryFn: async () => {
      const { roles } = await listWsRoles();
      return roles;
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}
