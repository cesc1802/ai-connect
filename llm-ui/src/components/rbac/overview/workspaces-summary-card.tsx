import { ChevronRight, Layers } from 'lucide-react';

import { RoleBadge } from '@/components/rbac/role-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Workspace } from '@/schemas/workspace';

interface WorkspacesSummaryCardProps {
  workspaces: Workspace[];
  loading?: boolean;
  onViewAllClick?: () => void;
  onOpenWorkspace?: (ws: Workspace) => void;
  className?: string;
}

export function WorkspacesSummaryCard({
  workspaces,
  loading = false,
  onViewAllClick,
  onOpenWorkspace,
  className,
}: WorkspacesSummaryCardProps) {
  const visible = workspaces.slice(0, 5);
  return (
    <section
      data-slot="workspaces-summary-card"
      aria-label="Workspaces"
      className={cn(
        'bg-card border-border rounded-xl border p-5',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Workspaces</h3>
        <button
          type="button"
          onClick={onViewAllClick}
          className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          Tất cả <ChevronRight className="size-3" aria-hidden={true} />
        </button>
      </div>
      {loading ? (
        <WorkspacesSummaryLoading />
      ) : visible.length === 0 ? (
        <p
          data-slot="workspaces-summary-empty"
          className="text-muted-foreground py-4 text-sm"
        >
          Chưa có workspace nào.
        </p>
      ) : (
        <ul
          className="grid gap-3 sm:grid-cols-2"
          role="list"
          data-slot="workspaces-summary-grid"
        >
          {visible.map((ws) => (
            <li key={ws.id}>
              <button
                type="button"
                onClick={() => onOpenWorkspace?.(ws)}
                className={cn(
                  'bg-background border-border hover:border-primary/30 flex w-full cursor-pointer items-center gap-3 rounded-lg border p-4 text-left transition-all hover:shadow-md',
                )}
                data-workspace-id={ws.id}
              >
                <span
                  aria-hidden={true}
                  className="bg-primary/10 text-primary inline-flex size-10 shrink-0 items-center justify-center rounded-md"
                >
                  <Layers className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {ws.name}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    {ws.slug}
                  </div>
                </div>
                <RoleBadge role={ws.role} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WorkspacesSummaryLoading() {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2"
      data-slot="workspaces-summary-loading"
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="border-border flex items-center gap-3 rounded-lg border p-4"
        >
          <Skeleton className="size-10 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-14 rounded-md" />
        </div>
      ))}
    </div>
  );
}
