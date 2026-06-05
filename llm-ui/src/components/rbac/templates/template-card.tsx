import * as React from 'react';
import { CopyIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { TemplateTagChip } from '@/components/rbac/templates/template-tag-chip';
import type { OrgTemplateRow } from '@/schemas/admin';

interface TemplateCardProps {
  row: OrgTemplateRow;
  onEdit: (row: OrgTemplateRow) => void;
  onDelete: (row: OrgTemplateRow) => void;
}

async function copyBody(body: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(body);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function TemplateCard({ row, onEdit, onDelete }: TemplateCardProps) {
  const updated = React.useMemo(() => {
    try {
      return new Date(row.updatedAt).toLocaleDateString('vi-VN');
    } catch {
      return row.updatedAt;
    }
  }, [row.updatedAt]);

  async function handleCopy() {
    const ok = await copyBody(row.body);
    if (ok) toast.success('Đã sao chép vào clipboard.');
    else toast.error('Không thể sao chép.');
  }

  return (
    <article
      data-slot="template-card"
      data-template-id={row.id}
      className="group bg-card flex flex-col gap-3 rounded-xl border p-4 transition-all hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold" title={row.name}>
          {row.name}
        </h3>
        <div
          data-slot="template-card-actions"
          className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Sao chép template ${row.name}`}
            onClick={handleCopy}
          >
            <CopyIcon className="size-4" aria-hidden={true} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Sửa template ${row.name}`}
            onClick={() => onEdit(row)}
          >
            <PencilIcon className="size-4" aria-hidden={true} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Xoá template ${row.name}`}
            onClick={() => onDelete(row)}
          >
            <Trash2Icon className="size-4" aria-hidden={true} />
          </Button>
        </div>
      </div>
      {row.description ? (
        <p className="text-muted-foreground line-clamp-2 text-xs">
          {row.description}
        </p>
      ) : null}
      {row.tags.length > 0 ? (
        <ul role="list" className="flex flex-wrap gap-1.5">
          {row.tags.map((t) => (
            <li key={t}>
              <TemplateTagChip tag={t} asButton={false} />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-auto flex items-center justify-between border-t pt-2.5 text-2xs">
        <time
          dateTime={row.updatedAt}
          className="text-muted-foreground tabular-nums"
        >
          {updated}
        </time>
      </div>
    </article>
  );
}
