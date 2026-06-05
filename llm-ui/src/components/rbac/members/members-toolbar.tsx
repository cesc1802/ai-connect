import * as React from 'react';
import { SearchIcon, UserPlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { OrgUserStatus } from '@/schemas/admin';

export type MembersStatusFilter = OrgUserStatus | 'all';

const STATUS_CHIPS: ReadonlyArray<{ key: MembersStatusFilter; label: string }> =
  [
    { key: 'all', label: 'Tất cả' },
    { key: 'active', label: 'Hoạt động' },
    { key: 'pending', label: 'Đang mời' },
    { key: 'disabled', label: 'Vô hiệu hoá' },
  ];
// TODO: add org-role chips once OrgUserRow exposes an orgRole field.

interface MembersToolbarProps {
  query: string;
  status: MembersStatusFilter;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: MembersStatusFilter) => void;
  onInviteClick: () => void;
}

export function MembersToolbar({
  query,
  status,
  onQueryChange,
  onStatusChange,
  onInviteClick,
}: MembersToolbarProps) {
  const searchId = React.useId();
  return (
    <div
      data-slot="members-toolbar"
      className="flex flex-wrap items-center gap-2"
    >
      <div className="relative max-w-xs flex-1">
        <SearchIcon
          aria-hidden={true}
          className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2"
        />
        <label htmlFor={searchId} className="sr-only">
          Tìm theo tên hoặc email
        </label>
        <Input
          id={searchId}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Tìm theo tên hoặc email…"
          className="pl-9"
          data-testid="members-search-input"
        />
      </div>

      <div
        role="group"
        aria-label="Lọc trạng thái thành viên"
        className="bg-muted text-muted-foreground inline-flex h-9 items-center gap-1 rounded-lg p-1"
      >
        {STATUS_CHIPS.map((chip) => {
          const active = chip.key === status;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => onStatusChange(chip.key)}
              aria-pressed={active}
              data-status-chip={chip.key}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:text-foreground',
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="ml-auto">
        <Button
          type="button"
          onClick={onInviteClick}
          data-testid="members-invite-trigger"
        >
          <UserPlusIcon aria-hidden={true} className="size-4" />
          Mời thành viên
        </Button>
      </div>
    </div>
  );
}
