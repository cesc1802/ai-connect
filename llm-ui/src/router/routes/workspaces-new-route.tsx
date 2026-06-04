import { createRoute, redirect } from '@tanstack/react-router';

import { unauthenticatedRoute } from './unauthenticated-route';
import { WorkspacesNewPage } from '@/pages/workspaces-new-page';

export const workspacesNewRoute = createRoute({
  getParentRoute: () => unauthenticatedRoute,
  path: '/workspaces/new',
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' });
    }
  },
  component: WorkspacesNewPage,
});
