import * as React from 'react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface DataTableSkeletonProps {
  columnCount: number;
  rowCount?: number;
  className?: string;
}

export function DataTableSkeleton({
  columnCount,
  rowCount = 4,
  className,
}: DataTableSkeletonProps) {
  const rows = React.useMemo(
    () => Array.from({ length: rowCount }, (_, i) => i),
    [rowCount],
  );
  const cols = React.useMemo(
    () => Array.from({ length: columnCount }, (_, i) => i),
    [columnCount],
  );
  return (
    <div
      data-slot="data-table-skeleton"
      role="status"
      aria-busy={true}
      aria-label="Loading rows"
      className={cn('flex flex-col gap-2', className)}
    >
      {rows.map((r) => (
        <div
          key={r}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
        >
          {cols.map((c) => (
            <Skeleton key={c} className="h-8 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
