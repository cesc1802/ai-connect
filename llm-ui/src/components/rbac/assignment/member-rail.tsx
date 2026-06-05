import * as React from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { OrgUserRow } from '@/schemas/admin';

interface MemberRailProps {
  users: OrgUserRow[];
  selectedUserId: string | null;
  onSelect: (userId: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  assignmentCounts: Map<string, number>;
  isLoading?: boolean;
}

function emailToInitial(email: string): string {
  return email.charAt(0).toUpperCase();
}

export function MemberRail({
  users,
  selectedUserId,
  onSelect,
  query,
  onQueryChange,
  assignmentCounts,
  isLoading,
}: MemberRailProps) {
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.email.toLowerCase().includes(q));
  }, [users, query]);

  return (
    <aside
      data-slot="assignment-member-rail"
      aria-label="Danh sách thành viên"
      className="bg-card flex h-full w-full flex-col border-r"
    >
      <div className="border-b p-3">
        <div className="relative">
          <Search
            className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Tìm thành viên…"
            aria-label="Tìm thành viên"
            className="h-9 pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2" role="listbox">
        {isLoading ? (
          <div className="text-muted-foreground p-3 text-xs" aria-busy="true">
            Đang tải…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-muted-foreground p-3 text-xs">
            Không có thành viên phù hợp.
          </div>
        ) : (
          filtered.map((u) => {
            const count = assignmentCounts.get(u.id) ?? 0;
            const isActive = selectedUserId === u.id;
            return (
              <button
                key={u.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => onSelect(u.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors',
                  isActive ? 'bg-accent' : 'hover:bg-accent/50',
                )}
              >
                <span
                  aria-hidden="true"
                  className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                >
                  {emailToInitial(u.email)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{u.email}</div>
                  <div className="text-muted-foreground truncate text-[11px]">
                    {count > 0 ? `${count} workspace` : 'Chưa gán'}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
