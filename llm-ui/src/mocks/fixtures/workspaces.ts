import type { Workspace } from '@/schemas/workspace';

export const DEMO_WORKSPACES: Workspace[] = [
  {
    id: 'wsp_personal',
    name: 'Personal',
    slug: 'personal',
    role: 'owner',
  },
  {
    id: 'wsp_acme',
    name: 'Acme Inc.',
    slug: 'acme-inc',
    role: 'admin',
  },
];
