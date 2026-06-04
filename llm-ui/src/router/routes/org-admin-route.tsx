import * as React from 'react';
import { createRoute, redirect } from '@tanstack/react-router';

import { adminRoute } from './admin-route';
import { AdminConsoleShell } from '@/components/admin/admin-console-shell';
import { AdminTabs } from '@/components/admin/admin-tabs';
import { DataTableSkeleton } from '@/components/admin/data-table-skeleton';

const UsersTab = React.lazy(() =>
  import('@/components/admin/org/users-tab').then((m) => ({
    default: m.UsersTab,
  })),
);

const TemplatesTab = React.lazy(() =>
  import('@/components/admin/org/templates-tab').then((m) => ({
    default: m.TemplatesTab,
  })),
);

const ProvidersTab = React.lazy(() =>
  import('@/components/admin/org/providers-tab').then((m) => ({
    default: m.ProvidersTab,
  })),
);

function OrgAdminShell() {
  return (
    <AdminConsoleShell
      title="Organization Admin"
      headingId="org-admin-heading"
      description="Manage users, providers, and shared templates across the organization."
    >
      <AdminTabs
        ariaLabel="Organization admin sections"
        defaultValue="users"
        mobileSelectLabel="Choose organization section"
        items={[
          {
            value: 'users',
            label: 'Users',
            content: (
              <React.Suspense fallback={<DataTableSkeleton columnCount={4} />}>
                <UsersTab />
              </React.Suspense>
            ),
          },
          {
            value: 'providers',
            label: 'Providers',
            content: (
              <React.Suspense fallback={<DataTableSkeleton columnCount={4} />}>
                <ProvidersTab />
              </React.Suspense>
            ),
          },
          {
            value: 'templates',
            label: 'Template Library',
            content: (
              <React.Suspense fallback={<DataTableSkeleton columnCount={3} />}>
                <TemplatesTab />
              </React.Suspense>
            ),
          },
        ]}
      />
    </AdminConsoleShell>
  );
}

export const orgAdminRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'org',
  beforeLoad: ({ context }) => {
    if (context.session?.orgRole !== 'admin') {
      throw redirect({ to: '/admin/403', replace: true });
    }
  },
  component: OrgAdminShell,
});
