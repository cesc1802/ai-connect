import {
  Building2,
  Users,
  Plug,
  FileStack,
  BarChart3,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { BackToWorkspace } from '@/components/sidebar/back-to-workspace';
import { SidebarSection } from '@/components/sidebar/sidebar-section';
import { useSessionUser } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

type BuiltItem = {
  key: 'workspaces' | 'users' | 'providers' | 'templates';
  label: string;
  Icon: LucideIcon;
};

type StubItem = {
  key: 'usage' | 'audit' | 'org-settings';
  label: string;
  Icon: LucideIcon;
};

/**
 * Tab deep-links into /admin/org are not wired yet (admin-consoles plan owns
 * the tab contract). All built items currently land on the bare route, which
 * opens the default Users tab. Switch to ?tab=… once that contract lands.
 */
const BUILT_ITEMS: BuiltItem[] = [
  { key: 'workspaces', label: 'Workspaces', Icon: Building2 },
  { key: 'users', label: 'Users', Icon: Users },
  { key: 'providers', label: 'Providers', Icon: Plug },
  { key: 'templates', label: 'Template Library', Icon: FileStack },
];

const STUB_ITEMS: StubItem[] = [
  { key: 'usage', label: 'Usage & Billing', Icon: BarChart3 },
  { key: 'audit', label: 'Audit Log', Icon: ScrollText },
  { key: 'org-settings', label: 'Org Settings', Icon: Settings },
];

export function OrgSections() {
  const user = useSessionUser();
  if (!user || user.orgRole !== 'admin') return null;

  return (
    <>
      <SidebarSection title="Organization">
        <nav
          aria-label="Organization sections"
          className="flex flex-col gap-0.5"
        >
          {BUILT_ITEMS.map(({ key, label, Icon }) => (
            <Link
              key={key}
              to="/admin/org"
              className={cn(
                'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2 rounded-md px-3 py-1.5 text-sm',
              )}
              data-tab-key={key}
            >
              <Icon className="size-3.5 shrink-0 opacity-80" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
          {STUB_ITEMS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              disabled
              aria-disabled="true"
              title="Coming soon"
              className={cn(
                'text-sidebar-foreground/60 flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm',
              )}
              data-stub-key={key}
            >
              <Icon className="size-3.5 shrink-0 opacity-60" />
              <span className="truncate">{label}</span>
              <span className="text-sidebar-foreground/50 ml-auto text-[10px] uppercase tracking-wide">
                Soon
              </span>
            </button>
          ))}
        </nav>
      </SidebarSection>

      <div className="px-2">
        <BackToWorkspace />
      </div>
    </>
  );
}
