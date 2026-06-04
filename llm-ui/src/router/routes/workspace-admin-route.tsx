import { createRoute, redirect } from '@tanstack/react-router';

import { adminRoute } from './admin-route';
import { AdminConsoleShell } from '@/components/admin/admin-console-shell';
import { AdminTabs } from '@/components/admin/admin-tabs';
import { EmptyState } from '@/components/admin/empty-state';

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
            content: <WorkspaceAdminPlaceholder label="Members" />,
          },
          {
            value: 'roles',
            label: 'Roles',
            content: <WorkspaceAdminPlaceholder label="Roles" />,
          },
          {
            value: 'providers',
            label: 'Providers',
            content: <WorkspaceAdminPlaceholder label="Providers" />,
          },
          {
            value: 'templates',
            label: 'Templates',
            content: <WorkspaceAdminPlaceholder label="Templates" />,
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
