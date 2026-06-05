import { cn } from '@/lib/utils';
import { TemplateCard } from '@/components/rbac/templates/template-card';
import type { OrgTemplateRow } from '@/schemas/admin';

interface TemplateGridProps {
  rows: OrgTemplateRow[];
  onEdit: (row: OrgTemplateRow) => void;
  onDelete: (row: OrgTemplateRow) => void;
  className?: string;
}

export function TemplateGrid({
  rows,
  onEdit,
  onDelete,
  className,
}: TemplateGridProps) {
  return (
    <div
      data-slot="template-grid"
      role="list"
      aria-label="Danh sách template"
      className={cn(
        'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {rows.map((row) => (
        <div key={row.id} role="listitem">
          <TemplateCard row={row} onEdit={onEdit} onDelete={onDelete} />
        </div>
      ))}
    </div>
  );
}
