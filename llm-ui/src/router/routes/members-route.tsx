import * as React from 'react';
import { createRoute, redirect } from '@tanstack/react-router';

import { adminRoute } from './admin-route';
import { DataTableSkeleton } from '@/components/admin/data-table-skeleton';

const MembersPage = React.lazy(() =>
  import('@/pages/members-page').then((m) => ({ default: m.MembersPage })),
);

function MembersRouteComponent() {
  return (
    <React.Suspense fallback={<DataTableSkeleton columnCount={5} />}>
      <MembersPage />
    </React.Suspense>
  );
}

export const membersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'members',
  beforeLoad: ({ context }) => {
    if (context.session?.orgRole !== 'admin') {
      throw redirect({ to: '/admin/403', replace: true });
    }
  },
  component: MembersRouteComponent,
});
