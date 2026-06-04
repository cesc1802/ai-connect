import * as React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { cn } from '@/lib/utils';
import { useSidebarCollapsed } from '@/stores/sidebar-ui-store';
import { CollapseToggle } from './collapse-toggle';

type SidebarShellProps = {
  /** Header slot above the section region (e.g. workspace switcher). */
  header?: React.ReactNode;
  /** Section content. Receives the resolved `collapsed` state via children prop. */
  children: React.ReactNode;
  /** Bottom account slot (e.g. account menu). */
  account?: React.ReactNode;
  /**
   * `mobile` removes the fixed rail/icon-rail behavior (always full-width inside
   * the Sheet overlay). Defaults to `desktop`.
   */
  variant?: 'desktop' | 'mobile';
};

const SECTIONS_ID = 'sidebar-sections';

export function SidebarShell({
  header,
  children,
  account,
  variant = 'desktop',
}: SidebarShellProps) {
  const collapsed = useSidebarCollapsed();
  const railMode = variant === 'desktop' && collapsed;

  return (
    <aside
      data-slot="sidebar-shell"
      data-collapsed={railMode ? 'true' : 'false'}
      className={cn(
        'bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full flex-col border-r',
        variant === 'desktop' && 'w-full',
      )}
    >
      <div className="border-sidebar-border flex items-center gap-2 border-b px-2 py-2">
        <CollapseToggle controlsId={SECTIONS_ID} />
        {!railMode && <div className="min-w-0 flex-1">{header}</div>}
        {!railMode && (
          <div className="shrink-0">
            <ThemeToggle />
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <nav
          id={SECTIONS_ID}
          aria-label="Sidebar navigation"
          className="flex flex-col gap-2 py-2"
        >
          {children}
        </nav>
      </ScrollArea>

      {account ? (
        <div className="border-sidebar-border border-t px-2 py-2">{account}</div>
      ) : null}
    </aside>
  );
}
