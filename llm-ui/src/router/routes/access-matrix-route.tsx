import * as React from 'react';
import { createRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import { adminRoute } from './admin-route';

const AccessMatrixPage = React.lazy(() =>
  import('@/pages/access-matrix-page').then((m) => ({
    default: m.AccessMatrixPage,
  })),
);

const matrixSearchSchema = z.object({
  user: z.string().optional(),
  workspace: z.string().optional(),
});

export const accessMatrixRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'org/matrix',
  validateSearch: matrixSearchSchema,
  beforeLoad: ({ context }) => {
    if (context.session?.orgRole !== 'admin') {
      throw redirect({ to: '/admin/403', replace: true });
    }
  },
  component: function AccessMatrixRouteComponent() {
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
        <AccessMatrixPage />
      </React.Suspense>
    );
  },
});
