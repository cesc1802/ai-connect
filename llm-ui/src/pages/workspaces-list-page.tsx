import * as React from 'react';
import { Link } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';

// Route-tree registration owned by team-lead post-merge.
const TypedLink = Link as unknown as React.ComponentType<{
  to: string;
  children?: React.ReactNode;
}>;
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { WorkspaceCard } from '@/components/rbac/workspaces/workspace-card';
import { useWorkspaces } from '@/hooks/use-workspaces';

const CTA_LABEL = 'Tạo workspace mới';

function WorkspaceGridSkeleton() {
  return (
    <div
      data-slot="workspaces-list-skeleton"
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-36 w-full" />
      ))}
    </div>
  );
}

export function WorkspacesListPage() {
  const { data, isLoading, isError, refetch } = useWorkspaces();
  const workspaces = data?.workspaces ?? [];

  return (
    <main
      data-slot="workspaces-list-page"
      className="flex flex-col gap-6 p-6"
      aria-labelledby="workspaces-list-heading"
    >
      <PageHeader
        title="Workspaces"
        subtitle="Quản lý workspace trong tổ chức"
        headingId="workspaces-list-heading"
        actions={
          <Button asChild>
            <TypedLink to="/workspaces/new">{CTA_LABEL}</TypedLink>
          </Button>
        }
      />

      {isLoading ? (
        <WorkspaceGridSkeleton />
      ) : isError ? (
        <div
          data-slot="workspaces-list-error"
          role="alert"
          className="text-destructive flex flex-col items-start gap-3"
        >
          <p>Không tải được danh sách workspace.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void refetch();
            }}
          >
            Thử lại
          </Button>
        </div>
      ) : workspaces.length === 0 ? (
        <div
          data-slot="workspaces-list-empty"
          className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm"
        >
          Chưa có workspace nào
        </div>
      ) : (
        <div
          data-slot="workspaces-list-grid"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {workspaces.map((ws) => (
            <WorkspaceCard key={ws.id} workspace={ws} />
          ))}
        </div>
      )}
    </main>
  );
}

export default WorkspacesListPage;
