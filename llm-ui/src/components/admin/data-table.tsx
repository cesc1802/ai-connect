import * as React from 'react';

import { cn } from '@/lib/utils';
import { DataTableSkeleton } from '@/components/admin/data-table-skeleton';
import { DataTableEmpty } from '@/components/admin/data-table-empty';
import { DataTableError } from '@/components/admin/data-table-error';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  ariaLabel?: string;
  className?: string;
}

export type DataTableState = 'loading' | 'empty' | 'error' | 'ready';

interface DataTableProps<T> {
  caption: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  state?: DataTableState;
  errorMessage?: string;
  onRetry?: () => void;
  emptyHeading?: string;
  emptyBody?: React.ReactNode;
  emptyAction?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  state,
  errorMessage,
  onRetry,
  emptyHeading,
  emptyBody,
  emptyAction,
  className,
}: DataTableProps<T>) {
  const resolved: DataTableState =
    state ?? (rows.length === 0 ? 'empty' : 'ready');

  if (resolved === 'loading') {
    return <DataTableSkeleton columnCount={columns.length} />;
  }
  if (resolved === 'error') {
    return <DataTableError message={errorMessage} onRetry={onRetry} />;
  }
  if (resolved === 'empty') {
    return (
      <DataTableEmpty
        heading={emptyHeading}
        body={emptyBody}
        action={emptyAction}
      />
    );
  }

  return (
    <div
      data-slot="data-table"
      className={cn('overflow-x-auto rounded-md border', className)}
    >
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted text-muted-foreground">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                aria-label={col.ariaLabel}
                className={cn(
                  'px-3 py-2 text-left font-medium',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              data-slot="data-table-row"
              className="border-t"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn('px-3 py-2 align-middle', col.className)}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
