import * as React from 'react';

import { cn } from '@/lib/utils';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

export interface AdminTabItem {
  value: string;
  label: string;
  content: React.ReactNode;
}

interface AdminTabsProps {
  ariaLabel: string;
  defaultValue: string;
  items: AdminTabItem[];
  mobileSelectLabel?: string;
  className?: string;
}

function useIsNarrowViewport(breakpoint = 768): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const subscribe = React.useCallback(
    (notify: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => mql.removeEventListener('change', notify);
    },
    [query],
  );
  const get = React.useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);
  return React.useSyncExternalStore(subscribe, get, () => false);
}

export function AdminTabs({
  ariaLabel,
  defaultValue,
  items,
  mobileSelectLabel = 'Choose section',
  className,
}: AdminTabsProps) {
  const [value, setValue] = React.useState(defaultValue);
  const isNarrow = useIsNarrowViewport();
  const selectId = React.useId();

  return (
    <Tabs
      value={value}
      onValueChange={setValue}
      className={cn('w-full', className)}
      data-slot="admin-tabs"
    >
      {isNarrow ? (
        <div className="flex flex-col gap-2">
          <label
            htmlFor={selectId}
            className="text-foreground text-sm font-medium"
          >
            {mobileSelectLabel}
          </label>
          <select
            id={selectId}
            data-slot="admin-tabs-select"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
          >
            {items.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <TabsList aria-label={ariaLabel}>
          {items.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
      {items.map((item) => (
        <TabsContent
          key={item.value}
          value={item.value}
          data-slot="admin-tab-panel"
        >
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
