import { http, HttpResponse } from 'msw';
import type { WsRoleCatalogueEntry } from '@/schemas/admin';

const ROLES: WsRoleCatalogueEntry[] = [
  {
    role: 'owner',
    description: 'Full control of the workspace. Cannot be removed.',
  },
  {
    role: 'admin',
    description:
      'Manage members, providers, templates, and quotas. At least one Admin is required.',
  },
  {
    role: 'member',
    description: 'Use providers and templates to run chats and workflows.',
  },
  {
    role: 'viewer',
    description: 'Read-only access to shared resources.',
  },
];

export const adminWsRolesHandlers = [
  http.get('/api/admin/workspace/roles', () => {
    return HttpResponse.json({ roles: ROLES });
  }),
];
