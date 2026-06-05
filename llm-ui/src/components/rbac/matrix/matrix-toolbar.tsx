import * as React from 'react';
import { Check, Filter, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Workspace } from '@/schemas/workspace';

interface MatrixToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  workspaces: Workspace[];
  selectedWorkspaceIds: string[];
  onSelectedWorkspaceIdsChange: (ids: string[]) => void;
  className?: string;
}

export function MatrixToolbar({
  search,
  onSearchChange,
  workspaces,
  selectedWorkspaceIds,
  onSelectedWorkspaceIdsChange,
  className,
}: MatrixToolbarProps) {
  const selectedSet = React.useMemo(
    () => new Set(selectedWorkspaceIds),
    [selectedWorkspaceIds],
  );
  const allSelected =
    workspaces.length > 0 && selectedSet.size === workspaces.length;

  function toggle(wsId: string) {
    const next = new Set(selectedSet);
    if (next.has(wsId)) next.delete(wsId);
    else next.add(wsId);
    onSelectedWorkspaceIdsChange(Array.from(next));
  }

  function selectAll() {
    onSelectedWorkspaceIdsChange(workspaces.map((w) => w.id));
  }

  function clearAll() {
    onSelectedWorkspaceIdsChange([]);
  }

  return (
    <div
      data-slot="matrix-toolbar"
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="relative max-w-sm flex-1">
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm theo email"
          aria-label="Tìm thành viên theo email"
          className="pl-8"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-slot="matrix-ws-filter"
            aria-label="Lọc theo workspace"
          >
            <Filter className="size-4" aria-hidden="true" />
            <span>Workspace</span>
            <span
              data-slot="matrix-ws-filter-count"
              className="bg-muted text-muted-foreground ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[10px]"
            >
              {allSelected ? 'All' : selectedSet.size}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-0">
          <div className="border-b px-3 py-2 text-xs font-medium">
            Chọn workspace
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {workspaces.map((ws) => {
              const checked = selectedSet.has(ws.id);
              return (
                <button
                  type="button"
                  key={ws.id}
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  onClick={() => toggle(ws.id)}
                  className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
                >
                  <span
                    className={cn(
                      'inline-flex size-4 items-center justify-center rounded border',
                      checked
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background',
                    )}
                  >
                    {checked ? <Check className="size-3" aria-hidden="true" /> : null}
                  </span>
                  <span className="truncate">{ws.name}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t px-2 py-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
            >
              Bỏ chọn
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={selectAll}
            >
              Chọn tất cả
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
