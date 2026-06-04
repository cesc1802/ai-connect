import type { SessionUser } from '@/schemas/auth';

export const DEMO_USER: SessionUser = {
  id: 'usr_demo_001',
  email: 'demo@ai-connect.local',
  displayName: 'Demo User',
  orgId: 'org-demo',
  orgRole: 'admin',
  workspaceId: 'ws-demo',
  workspaceRole: 'admin',
};

export const DEMO_PASSWORD = 'demopass123';

export const DEMO_ACCESS_TOKEN = 'demo.access.token.v1';
export const DEMO_REFRESH_COOKIE = 'demo.refresh.cookie.v1';
export const DEMO_EXPIRES_IN_SEC = 60 * 15;

export const DEMO_OWNER_USER: SessionUser = {
  id: 'usr_demo_owner_001',
  email: 'owner@ai-connect.local',
  displayName: 'Owner User',
  orgId: 'org-demo',
  orgRole: 'admin',
  workspaceId: 'ws-demo',
  workspaceRole: 'owner',
};

export const DEMO_OWNER_PASSWORD = 'ownerpass123';

export const DEMO_OWNER_ACCESS_TOKEN = 'demo.access.owner.v1';
export const DEMO_OWNER_REFRESH_COOKIE = 'demo.refresh.owner.v1';
