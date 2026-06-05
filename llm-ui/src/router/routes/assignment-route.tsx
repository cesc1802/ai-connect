import * as React from 'react';
import { createRoute, redirect } from '@tanstack/react-router';

import { adminRoute } from './admin-route';

const AssignmentPage = React.lazy(() =>
  import('@/pages/assignment-page').then((m) => ({
    default: m.AssignmentPage,
  })),
);

export const assignmentRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'org/permissions',
  beforeLoad: ({ context }) => {
    if (context.session?.orgRole !== 'admin') {
      throw redirect({ to: '/admin/403', replace: true });
    }
  },
  component: function AssignmentRouteComponent() {
    return (
      <React.Suspense
        fallback={
          <div
            aria-busy="true"
            className="text-muted-foreground p-6 text-sm"
          >
            Đang tải…
          </div>
        }
      >
        <AssignmentPage />
      </React.Suspense>
    );
  },
});
