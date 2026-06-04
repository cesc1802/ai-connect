import type { Workspace } from '@/schemas/workspace';

export const DEMO_WORKSPACES: Workspace[] = [
  {
    id: 'wsp_personal',
    name: 'Personal',
    slug: 'personal',
    role: 'owner',
    orgId: 'org-demo',
    orgName: 'Demo Org',
  },
  {
    id: 'wsp_acme',
    name: 'Acme Inc.',
    slug: 'acme-inc',
    role: 'admin',
    orgId: 'org-demo',
    orgName: 'Demo Org',
  },
  {
    id: 'wsp_research',
    name: 'Research Lab',
    slug: 'research-lab',
    role: 'member',
    orgId: 'org-demo',
    orgName: 'Demo Org',
  },
];
