import { createRoute, redirect } from '@tanstack/react-router';

import { adminRoute } from './admin-route';
import { AdminConsoleShell } from '@/components/admin/admin-console-shell';
import { AdminTabs } from '@/components/admin/admin-tabs';
import { EmptyState } from '@/components/admin/empty-state';

function OrgAdminPlaceholder({ label }: { label: string }) {
  return (
    <EmptyState
      heading={`${label} coming soon`}
      body="This section will be populated by a follow-up phase."
    />
  );
}

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
            content: <OrgAdminPlaceholder label="Users" />,
          },
          {
            value: 'providers',
            label: 'Providers',
            content: <OrgAdminPlaceholder label="Providers" />,
          },
          {
            value: 'templates',
            label: 'Template Library',
            content: <OrgAdminPlaceholder label="Template Library" />,
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
