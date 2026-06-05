import * as React from 'react';
import { createRoute, redirect } from '@tanstack/react-router';

import { adminRoute } from './admin-route';
import { DataTableSkeleton } from '@/components/admin/data-table-skeleton';

const TemplatesLibraryPage = React.lazy(() =>
  import('@/pages/templates-library-page').then((m) => ({
    default: m.TemplatesLibraryPage,
  })),
);

function TemplatesRouteComponent() {
  return (
    <React.Suspense fallback={<DataTableSkeleton columnCount={3} rowCount={3} />}>
      <TemplatesLibraryPage />
    </React.Suspense>
  );
}

export const templatesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'org/templates',
  beforeLoad: ({ context }) => {
    if (context.session?.orgRole !== 'admin') {
      throw redirect({ to: '/admin/403', replace: true });
    }
  },
  component: TemplatesRouteComponent,
});
