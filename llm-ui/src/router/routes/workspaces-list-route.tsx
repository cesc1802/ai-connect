import { createRoute, redirect } from '@tanstack/react-router';

import { authenticatedRoute } from './authenticated-route';
import { WorkspacesListPage } from '@/pages/workspaces-list-page';

export const workspacesListRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/workspaces',
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login', replace: true });
    }
  },
  component: WorkspacesListPage,
});
