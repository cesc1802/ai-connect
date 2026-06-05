import { createRoute, redirect } from '@tanstack/react-router';

import { authenticatedRoute } from './authenticated-route';
import { WorkspaceDetailPage } from '@/pages/workspace-detail-page';

export const workspaceDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/workspaces/$workspaceId',
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login', replace: true });
    }
    const { orgRole, workspaceRole } = context.session;
    const allowed =
      orgRole === 'admin' || workspaceRole === 'admin' || workspaceRole === 'owner';
    if (!allowed) {
      throw redirect({ to: '/admin/403', replace: true });
    }
  },
  component: WorkspaceDetailPage,
});
