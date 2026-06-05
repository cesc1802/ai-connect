import * as React from 'react';

import { cn } from '@/lib/utils';
import { TemplateTagChip } from '@/components/rbac/templates/template-tag-chip';
import type { OrgTemplateRow } from '@/schemas/admin';

const ALL_LABEL = 'Tất cả';

export interface TagCount {
  tag: string;
  count: number;
}

export function collectTagCounts(rows: OrgTemplateRow[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const t of r.tags) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

interface TemplateFilterSidebarProps {
  rows: OrgTemplateRow[];
  selected: string[];
  onToggle: (tag: string) => void;
  onReset: () => void;
  className?: string;
}

export function TemplateFilterSidebar({
  rows,
  selected,
  onToggle,
  onReset,
  className,
}: TemplateFilterSidebarProps) {
  const tagCounts = React.useMemo(() => collectTagCounts(rows), [rows]);
  const allActive = selected.length === 0;

  return (
    <aside
      data-slot="template-filter-sidebar"
      aria-label="Lọc theo nhãn"
      className={cn('flex flex-col gap-3', className)}
    >
      <div className="text-muted-foreground text-2xs font-semibold uppercase tracking-wider">
        Lọc theo nhãn
      </div>
      <div className="flex flex-wrap gap-1.5">
        <TemplateTagChip
          tag={ALL_LABEL}
          selected={allActive}
          onClick={onReset}
        />
        {tagCounts.map(({ tag, count }) => (
          <TemplateTagChip
            key={tag}
            tag={tag}
            count={count}
            selected={selected.includes(tag)}
            onClick={() => onToggle(tag)}
          />
        ))}
      </div>
    </aside>
  );
}
