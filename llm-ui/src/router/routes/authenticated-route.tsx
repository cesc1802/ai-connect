import { createRoute, redirect } from '@tanstack/react-router';
import { rootRoute } from './root-route';
import { AppShell } from '@/components/layout/app-shell';

export const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: ({ context, location }) => {
    if (!context.session) {
      throw redirect({
        to: '/login',
        search: { from: location.pathname },
      });
    }
  },
  component: AppShell,
});
