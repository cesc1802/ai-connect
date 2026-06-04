import * as React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useSidebarCollapsed } from '@/stores/sidebar-ui-store';

type SidebarSectionProps = {
  title: string;
  /** lucide icon component used in the rail popover trigger and expanded header. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Section body shown in expanded mode and inside the rail popover. */
  children: React.ReactNode;
  /** Trailing action(s) rendered on the expanded header row (e.g. New, All). */
  headerAction?: React.ReactNode;
  className?: string;
};

/**
 * Labeled section wrapper. Expanded: title above content.
 * Collapsed: trigger icon + popover flyout (UC-034 step 4, keyboard-reachable).
 */
export function SidebarSection({
  title,
  icon: Icon,
  children,
  headerAction,
  className,
}: SidebarSectionProps) {
  const collapsed = useSidebarCollapsed();

  if (collapsed) {
    return (
      <div className={cn('flex items-center justify-center px-1 py-1', className)}>
        <Popover>
          <PopoverTrigger
            aria-label={title}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring inline-flex size-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
          >
            {Icon ? <Icon className="size-4" /> : <span className="text-xs">{title[0]}</span>}
            <span className="sr-only">{title}</span>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="w-64 p-2">
            <div className="text-sidebar-foreground px-2 pb-1 text-xs font-semibold uppercase tracking-wide">
              {title}
            </div>
            {children}
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <section className={cn('flex flex-col gap-1 px-2 py-2', className)}>
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sidebar-foreground/70 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
          {Icon ? <Icon className="size-3.5" /> : null}
          {title}
        </h3>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}
