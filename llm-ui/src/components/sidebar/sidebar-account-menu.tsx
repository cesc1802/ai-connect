import { useState } from 'react';
import { LogOut, Settings2, User, FileText } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PreferencesDialog } from '@/components/sidebar/preferences-dialog';
import { useSessionUser } from '@/stores/auth-store';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useSidebarContext, useSidebarCollapsed } from '@/stores/sidebar-ui-store';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { useLogout } from '@/hooks/use-logout';
import { cn } from '@/lib/utils';

function initialsFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

function formatRole(role: string | null | undefined): string {
  if (!role) return 'Member';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Bottom-pinned account menu (UC-035, FR-041). Identity line is
 * context-reactive (BR-104):
 *  - workspace context: "{workspaceRole} · {activeWorkspaceName}"
 *  - org context:       "{orgRole} · Organization"
 *
 * Items: Profile (stub), Preferences (theme/language/default model),
 * My Templates (links to workspace templates console for admins/owners,
 * otherwise stub-info toast), Sign Out (UC-018).
 */
export function SidebarAccountMenu() {
  const user = useSessionUser();
  const context = useSidebarContext();
  const collapsed = useSidebarCollapsed();
  const activeWorkspaceId = useActiveWorkspaceStore((s) => s.activeWorkspaceId);
  const activeWorkspaceRole = useActiveWorkspaceStore((s) => s.activeWorkspaceRole);
  const { data } = useWorkspaces();
  const logoutMutation = useLogout();
  const [prefsOpen, setPrefsOpen] = useState(false);

  if (!user) return null;

  const activeWorkspace = data?.workspaces.find((w) => w.id === activeWorkspaceId);
  const workspaceName = activeWorkspace?.name ?? 'No workspace';

  const isOrg = context === 'org';
  const role = isOrg ? user.orgRole : (activeWorkspaceRole ?? user.workspaceRole);
  const scope = isOrg ? 'Organization' : workspaceName;
  const identityLine = `${formatRole(role)} · ${scope}`;

  const initials = initialsFor(user.displayName);
  const triggerLabel = `Open account menu for ${user.displayName}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            aria-label={triggerLabel}
            className={cn(
              'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground h-auto w-full gap-2 px-2 py-1.5',
              collapsed ? 'justify-center' : 'justify-start',
            )}
            data-slot="sidebar-account-trigger"
          >
            <span
              aria-hidden="true"
              className="bg-sidebar-accent text-sidebar-accent-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium"
            >
              {initials}
            </span>
            {!collapsed && (
              <span className="flex min-w-0 flex-col items-start text-left">
                <span className="text-sidebar-foreground max-w-[160px] truncate text-sm font-medium">
                  {user.displayName}
                </span>
                <span
                  className="text-sidebar-foreground/70 max-w-[160px] truncate text-xs"
                  data-slot="sidebar-account-identity"
                >
                  {identityLine}
                </span>
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          side="top"
          className="min-w-[220px]"
        >
          <DropdownMenuLabel className="flex flex-col">
            <span className="text-sm font-medium">{user.displayName}</span>
            <span className="text-muted-foreground truncate text-xs">
              {user.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => toast.message('Profile page is coming soon.')}
          >
            <User className="mr-2 size-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setPrefsOpen(true);
            }}
          >
            <Settings2 className="mr-2 size-4" />
            Preferences
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              toast.message(
                'Personal templates are coming soon. For now, see the Templates section in the sidebar.',
              )
            }
          >
            <FileText className="mr-2 size-4" />
            My Templates
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="mr-2 size-4" />
            {logoutMutation.isPending ? 'Signing out…' : 'Sign out'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PreferencesDialog open={prefsOpen} onOpenChange={setPrefsOpen} />
    </>
  );
}
