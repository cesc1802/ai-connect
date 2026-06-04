import { createRoute, Outlet, redirect } from '@tanstack/react-router';
import { authenticatedRoute } from './authenticated-route';

export const adminRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/admin',
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login', replace: true });
    }
  },
  component: Outlet,
});
