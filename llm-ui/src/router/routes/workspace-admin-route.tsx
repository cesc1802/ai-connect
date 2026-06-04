import * as React from 'react';
import { createRoute, redirect } from '@tanstack/react-router';

import { adminRoute } from './admin-route';
import { AdminConsoleShell } from '@/components/admin/admin-console-shell';
import { AdminTabs } from '@/components/admin/admin-tabs';
import { DataTableSkeleton } from '@/components/admin/data-table-skeleton';
import { EmptyState } from '@/components/admin/empty-state';

const MembersTab = React.lazy(() =>
  import('@/components/admin/workspace/members-tab').then((m) => ({
    default: m.MembersTab,
  })),
);

const RolesTab = React.lazy(() =>
  import('@/components/admin/workspace/roles-tab').then((m) => ({
    default: m.RolesTab,
  })),
);

const WsProvidersTab = React.lazy(() =>
  import('@/components/admin/workspace/ws-providers-tab').then((m) => ({
    default: m.WsProvidersTab,
  })),
);

const WsTemplatesTab = React.lazy(() =>
  import('@/components/admin/workspace/ws-templates-tab').then((m) => ({
    default: m.WsTemplatesTab,
  })),
);

function WorkspaceAdminPlaceholder({ label }: { label: string }) {
  return (
    <EmptyState
      heading={`${label} coming soon`}
      body="This section will be populated by a follow-up phase."
    />
  );
}

function WorkspaceAdminShell() {
  return (
    <AdminConsoleShell
      title="Workspace Admin"
      headingId="workspace-admin-heading"
      description="Manage members, roles, providers, templates, and quotas for this workspace."
    >
      <AdminTabs
        ariaLabel="Workspace admin sections"
        defaultValue="members"
        mobileSelectLabel="Choose workspace section"
        items={[
          {
            value: 'members',
            label: 'Members',
            content: (
              <React.Suspense fallback={<DataTableSkeleton columnCount={4} />}>
                <MembersTab />
              </React.Suspense>
            ),
          },
          {
            value: 'roles',
            label: 'Roles',
            content: (
              <React.Suspense fallback={<DataTableSkeleton columnCount={2} />}>
                <RolesTab />
              </React.Suspense>
            ),
          },
          {
            value: 'providers',
            label: 'Providers',
            content: (
              <React.Suspense fallback={<DataTableSkeleton columnCount={2} />}>
                <WsProvidersTab />
              </React.Suspense>
            ),
          },
          {
            value: 'templates',
            label: 'Templates',
            content: (
              <React.Suspense fallback={<DataTableSkeleton columnCount={2} />}>
                <WsTemplatesTab />
              </React.Suspense>
            ),
          },
          {
            value: 'quotas',
            label: 'Quotas',
            content: <WorkspaceAdminPlaceholder label="Quotas" />,
          },
        ]}
      />
    </AdminConsoleShell>
  );
}

export const workspaceAdminRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'workspace',
  beforeLoad: ({ context }) => {
    const role = context.session?.workspaceRole;
    if (role !== 'admin' && role !== 'owner') {
      throw redirect({ to: '/admin/403', replace: true });
    }
  },
  component: WorkspaceAdminShell,
});
