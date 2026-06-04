import { createRoute } from '@tanstack/react-router';
import { adminRoute } from './admin-route';
import { AdminForbiddenPage } from '@/pages/admin-forbidden-page';

export const adminForbiddenRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '403',
  component: AdminForbiddenPage,
});
