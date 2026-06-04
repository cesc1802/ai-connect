import { createRoute, redirect } from '@tanstack/react-router';

import { unauthenticatedRoute } from './unauthenticated-route';
import { NoWorkspaceGuardPage } from '@/pages/no-workspace-guard-page';

export const noWorkspaceGuardRoute = createRoute({
  getParentRoute: () => unauthenticatedRoute,
  path: '/no-workspace',
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' });
    }
  },
  component: NoWorkspaceGuardPage,
});
