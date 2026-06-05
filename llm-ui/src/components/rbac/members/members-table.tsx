import * as React from 'react';
import { ChevronRightIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { DataTableSkeleton } from '@/components/admin/data-table-skeleton';
import { DataTableEmpty } from '@/components/admin/data-table-empty';
import { DataTableError } from '@/components/admin/data-table-error';
import { StatusBadge, type StatusIntent } from '@/components/admin/status-badge';
import type { OrgUserRow, OrgUserStatus } from '@/schemas/admin';

const STATUS_INTENT: Record<OrgUserStatus, StatusIntent> = {
  active: 'active',
  pending: 'pending',
  disabled: 'disabled',
};

const STATUS_LABEL: Record<OrgUserStatus, string> = {
  active: 'Hoạt động',
  pending: 'Đang mời',
  disabled: 'Vô hiệu hoá',
};

function formatActivity(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

export type MembersTableState = 'loading' | 'empty' | 'error' | 'ready';

interface MembersTableProps {
  rows: OrgUserRow[];
  state: MembersTableState;
  onRowOpen: (row: OrgUserRow) => void;
  onRetry?: () => void;
  emptyHeading?: string;
  emptyBody?: string;
  errorMessage?: string;
  className?: string;
}

export function MembersTable({
  rows,
  state,
  onRowOpen,
  onRetry,
  emptyHeading = 'Không tìm thấy thành viên',
  emptyBody = 'Thử bỏ bộ lọc hoặc tìm với từ khoá khác.',
  errorMessage = 'Không thể tải danh sách thành viên.',
  className,
}: MembersTableProps) {
  if (state === 'loading') {
    return <DataTableSkeleton columnCount={5} />;
  }
  if (state === 'error') {
    return <DataTableError message={errorMessage} onRetry={onRetry} />;
  }
  if (state === 'empty') {
    return <DataTableEmpty heading={emptyHeading} body={emptyBody} />;
  }

  return (
    <div
      data-slot="members-table"
      className={cn('overflow-hidden rounded-xl border', className)}
    >
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Danh sách thành viên</caption>
        <thead className="bg-muted/60 text-muted-foreground text-xs">
          <tr>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Người dùng
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Vai trò org
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Workspace &amp; vai trò
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Hoạt động
            </th>
            <th scope="col" className="w-8">
              <span className="sr-only">Mở chi tiết</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              data-slot="members-row"
              data-row-id={row.id}
              className="hover:bg-accent/40 border-t transition-colors"
            >
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onRowOpen(row)}
                  data-testid={`members-row-trigger-${row.id}`}
                  className="text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:underline"
                >
                  {row.email}
                </button>
              </td>
              <td className="px-4 py-3">
                <span
                  aria-label="Chưa có vai trò org"
                  className="text-muted-foreground text-xs"
                >
                  —
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge intent={STATUS_INTENT[row.status]}>
                  {STATUS_LABEL[row.status]}
                </StatusBadge>
              </td>
              <td className="text-muted-foreground px-4 py-3 text-right text-xs">
                {formatActivity(row.joinedAt)}
              </td>
              <td className="px-2 py-3 text-right">
                <button
                  type="button"
                  aria-label={`Mở chi tiết ${row.email}`}
                  onClick={() => onRowOpen(row)}
                  className="text-muted-foreground/60 hover:text-foreground"
                >
                  <ChevronRightIcon aria-hidden={true} className="size-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
