import { Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarUiStore } from '@/stores/sidebar-ui-store';

export function SidebarOrgRow() {
  const user = useAuthStore((s) => s.user);
  const setContext = useSidebarUiStore((s) => s.setContext);

  if (!user) return null;
  const isAdmin = user.orgRole === 'admin';

  return (
    <div className="text-sidebar-foreground flex items-center justify-between gap-2 px-2 py-1 text-xs opacity-80">
      <span className="truncate" data-slot="sidebar-org-name">
        {user.orgId}
      </span>
      {isAdmin ? (
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground size-6"
          aria-label="Open organization settings"
          onClick={() => setContext('org')}
        >
          <Settings className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
