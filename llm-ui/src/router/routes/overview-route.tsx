import { createRoute, redirect } from '@tanstack/react-router';

import { OverviewPage } from '@/pages/overview-page';
import { adminRoute } from './admin-route';

export const overviewRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'org/overview',
  beforeLoad: ({ context }) => {
    if (context.session?.orgRole !== 'admin') {
      throw redirect({ to: '/admin/403', replace: true });
    }
  },
  component: OverviewPage,
});
