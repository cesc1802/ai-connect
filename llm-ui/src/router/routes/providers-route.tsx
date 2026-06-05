import { createRoute, redirect } from '@tanstack/react-router';

import { authenticatedRoute } from './authenticated-route';
import { ProvidersPage } from '@/pages/providers-page';

export const providersRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/providers',
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login', replace: true });
    }
    if (context.session.orgRole !== 'admin') {
      throw redirect({ to: '/admin/403', replace: true });
    }
  },
  component: ProvidersPage,
});
