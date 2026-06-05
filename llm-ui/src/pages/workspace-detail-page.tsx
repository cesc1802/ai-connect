import * as React from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';

// Route-tree registration for /workspaces routes is owned by team-lead
// post-merge; cast Link/navigate until typegen learns about them.
const TypedLink = Link as unknown as React.ComponentType<{
  to: string;
  className?: string;
  children?: React.ReactNode;
}>;
type TypedNavigate = (opts: { to: string }) => void | Promise<void>;

import { Button } from '@/components/ui/button';
import { AdminTabs } from '@/components/admin/admin-tabs';
import { DataTableSkeleton } from '@/components/admin/data-table-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { RoleBadge } from '@/components/rbac/role-badge';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';

const MembersTab = React.lazy(() =>
  import('@/components/admin/workspace/members-tab').then((m) => ({
    default: m.MembersTab,
  })),
);
const WsTemplatesTab = React.lazy(() =>
  import('@/components/admin/workspace/ws-templates-tab').then((m) => ({
    default: m.WsTemplatesTab,
  })),
);
const WsProvidersTab = React.lazy(() =>
  import('@/components/admin/workspace/ws-providers-tab').then((m) => ({
    default: m.WsProvidersTab,
  })),
);

export function WorkspaceDetailPage() {
  const { workspaceId } = useParams({ strict: false }) as {
    workspaceId?: string;
  };
  const navigate = useNavigate();
  const { data, isLoading } = useWorkspaces();
  const setActiveWorkspace = useActiveWorkspaceStore(
    (s) => s.setActiveWorkspace,
  );

  const workspace = React.useMemo(
    () => data?.workspaces.find((w) => w.id === workspaceId),
    [data, workspaceId],
  );

  React.useEffect(() => {
    if (workspace) {
      setActiveWorkspace(workspace.id, workspace.role);
    }
  }, [workspace, setActiveWorkspace]);

  if (isLoading) {
    return (
      <main
        data-slot="workspace-detail-loading"
        className="flex flex-col gap-6 p-6"
      >
        <DataTableSkeleton columnCount={3} />
      </main>
    );
  }

  if (!workspace) {
    return (
      <main
        data-slot="workspace-detail-not-found"
        className="flex flex-col gap-4 p-6"
        aria-labelledby="workspace-detail-heading"
      >
        <PageHeader
          title="Workspace không tồn tại"
          headingId="workspace-detail-heading"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void (navigate as unknown as TypedNavigate)({ to: '/workspaces' })}
        >
          Quay lại
        </Button>
      </main>
    );
  }

  return (
    <main
      data-slot="workspace-detail-page"
      data-workspace-id={workspace.id}
      className="flex flex-col gap-6 p-6"
      aria-labelledby="workspace-detail-heading"
    >
      <PageHeader
        title={workspace.name}
        subtitle={workspace.slug}
        headingId="workspace-detail-heading"
        eyebrow={
          <TypedLink
            to="/workspaces"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            Quay lại
          </TypedLink>
        }
        actions={<RoleBadge role={workspace.role} />}
      />

      <AdminTabs
        ariaLabel="Workspace sections"
        defaultValue="members"
        mobileSelectLabel="Chọn mục"
        items={[
          {
            value: 'members',
            label: 'Thành viên',
            content: (
              <React.Suspense fallback={<DataTableSkeleton columnCount={4} />}>
                <MembersTab />
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
            value: 'providers',
            label: 'Providers',
            content: (
              <React.Suspense fallback={<DataTableSkeleton columnCount={2} />}>
                <WsProvidersTab />
              </React.Suspense>
            ),
          },
        ]}
      />
    </main>
  );
}

export default WorkspaceDetailPage;
