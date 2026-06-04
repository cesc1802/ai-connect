import { ChevronDown, Check, Plus, Settings } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { useWorkspaceSwitch } from '@/hooks/use-workspace-switch';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useSidebarUiStore } from '@/stores/sidebar-ui-store';
import { useAuthStore } from '@/stores/auth-store';
import type { Workspace } from '@/schemas/workspace';

function groupByOrg(workspaces: Workspace[]): Map<string, Workspace[]> {
  const groups = new Map<string, Workspace[]>();
  for (const ws of workspaces) {
    const label = ws.orgName ?? ws.orgId ?? 'Workspaces';
    const existing = groups.get(label);
    if (existing) existing.push(ws);
    else groups.set(label, [ws]);
  }
  return groups;
}

export function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const { data, isPending } = useWorkspaces();
  const activeId = useActiveWorkspaceStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkspaceSwitch();
  const setContext = useSidebarUiStore((s) => s.setContext);
  const orgRole = useAuthStore((s) => s.user?.orgRole ?? null);
  const isOrgAdmin = orgRole === 'admin';

  const workspaces = data?.workspaces ?? [];
  const active = workspaces.find((w) => w.id === activeId);
  const triggerLabel = active?.name ?? (isPending ? '' : 'Select workspace');
  const groups = groupByOrg(workspaces);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full justify-between px-2"
          aria-label="Switch workspace"
        >
          <span className="truncate text-sm font-medium">
            {isPending ? <Skeleton className="h-4 w-24" /> : triggerLabel}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56"
      >
        {Array.from(groups.entries()).map(([orgLabel, list], idx) => (
          <DropdownMenuGroup key={orgLabel}>
            {idx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs uppercase tracking-wide opacity-70">
              {orgLabel}
            </DropdownMenuLabel>
            {list.map((ws) => {
              const isActive = ws.id === activeId;
              return (
                <DropdownMenuItem
                  key={ws.id}
                  onSelect={() => void switchWorkspace(ws)}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn('flex items-center justify-between')}
                >
                  <span className="truncate">{ws.name}</span>
                  {isActive ? <Check className="size-4 opacity-100" /> : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        ))}
        {isOrgAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void navigate({ to: '/workspaces/pick' })}
            >
              <Plus className="size-4" />
              <span>New Workspace</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setContext('org')}>
              <Settings className="size-4" />
              <span>Org Settings</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
