import { Cog, Users, Plug, FileStack, Gauge, Settings2 } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { useRouterSession } from '@/hooks/use-router-session';
import { cn } from '@/lib/utils';

type Item = {
  key: string;
  label: string;
  Icon: typeof Cog;
};

/**
 * Tab deep-links into the workspace admin route are not wired yet on the
 * admin-consoles side (see phase-04 spec — "coordinate, do not edit"). All
 * five items currently land on the bare /admin/workspace route, which opens
 * the default Members tab. Switch to ?tab=… here once that contract lands.
 */
const ITEMS: Item[] = [
  { key: 'members', label: 'Members', Icon: Users },
  { key: 'providers', label: 'Providers', Icon: Plug },
  { key: 'templates', label: 'Templates', Icon: FileStack },
  { key: 'quotas', label: 'Usage', Icon: Gauge },
  { key: 'roles', label: 'Settings', Icon: Settings2 },
];

export function WorkspaceSettingsNav() {
  const session = useRouterSession();
  const role = session?.workspaceRole ?? null;
  if (role !== 'admin' && role !== 'owner') return null;

  return (
    <nav
      aria-label="Workspace settings"
      className="flex flex-col gap-0.5"
    >
      {ITEMS.map(({ key, label, Icon }) => (
        <Link
          key={key}
          to="/admin/workspace"
          className={cn(
            'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2 rounded-md px-3 py-1.5 text-sm',
          )}
          data-tab-key={key}
        >
          <Icon className="size-3.5 shrink-0 opacity-80" />
          <span className="truncate">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
