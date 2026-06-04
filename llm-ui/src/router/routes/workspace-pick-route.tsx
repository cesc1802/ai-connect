import { createRoute, redirect } from '@tanstack/react-router';
import { unauthenticatedRoute } from './unauthenticated-route';
import { WorkspacePickPage } from '@/pages/workspace-pick-page';

export const workspacePickRoute = createRoute({
  getParentRoute: () => unauthenticatedRoute,
  path: '/workspaces/pick',
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' });
    }
  },
  component: WorkspacePickPage,
});
