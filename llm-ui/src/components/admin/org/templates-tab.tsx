import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/admin/data-table';
import { EmptyState } from '@/components/admin/empty-state';
import { StatusBadge } from '@/components/admin/status-badge';
import { TemplateFormDialog } from '@/components/admin/org/template-form-dialog';
import { DeleteTemplateConfirm } from '@/components/admin/org/delete-template-confirm';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  useCreateOrgTemplate,
  useDeleteOrgTemplate,
  useOrgTemplates,
  useUpdateOrgTemplate,
} from '@/hooks/use-org-templates';
import { TemplateNameConflictError } from '@/api/admin-org-templates';
import type { OrgTemplateRow } from '@/schemas/admin';

export function TemplatesTab() {
  const { data: rows, isLoading, isError, refetch } = useOrgTemplates();
  const create = useCreateOrgTemplate();
  const update = useUpdateOrgTemplate();
  const remove = useDeleteOrgTemplate();

  const [query, setQuery] = React.useState('');
  const debouncedQuery = useDebouncedValue(query, 150);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState<OrgTemplateRow | null>(null);
  const [deleteRow, setDeleteRow] = React.useState<OrgTemplateRow | null>(null);
  const [createConflict, setCreateConflict] = React.useState(false);
  const [updateConflict, setUpdateConflict] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q || !rows) return rows ?? [];
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [rows, debouncedQuery]);

  const columns = React.useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        cell: (row: OrgTemplateRow) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.name}</span>
            {row.description ? (
              <span className="text-muted-foreground text-xs">
                {row.description}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'tags',
        header: 'Tags',
        cell: (row: OrgTemplateRow) =>
          row.tags.length === 0 ? (
            <span className="text-muted-foreground text-xs">—</span>
          ) : (
            <ul role="list" className="flex flex-wrap gap-1">
              {row.tags.map((t) => (
                <li key={t}>
                  <StatusBadge intent="info">{t}</StatusBadge>
                </li>
              ))}
            </ul>
          ),
      },
      {
        key: 'updated',
        header: 'Updated',
        cell: (row: OrgTemplateRow) => (
          <time dateTime={row.updatedAt} className="text-muted-foreground text-xs">
            {new Date(row.updatedAt).toLocaleDateString()}
          </time>
        ),
      },
      {
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        className: 'text-right',
        cell: (row: OrgTemplateRow) => (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setUpdateConflict(false);
                setEditRow(row);
              }}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeleteRow(row)}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const hasNoRows = !isLoading && !isError && (rows?.length ?? 0) === 0;
  const filterEmpty =
    !isLoading &&
    !isError &&
    (rows?.length ?? 0) > 0 &&
    filtered.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="w-full max-w-sm">
          <label htmlFor="templates-search" className="sr-only">
            Search templates
          </label>
          <Input
            id="templates-search"
            type="search"
            placeholder="Search by name or tag"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button
          type="button"
          onClick={() => {
            setCreateConflict(false);
            setAddOpen(true);
          }}
        >
          Create template
        </Button>
      </div>

      {filterEmpty ? (
        <EmptyState
          heading={`No templates match "${query}"`}
          body="Try a different search or clear the filter."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuery('')}
            >
              Clear filter
            </Button>
          }
        />
      ) : (
        <DataTable<OrgTemplateRow>
          caption="Organization templates"
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          state={
            isLoading
              ? 'loading'
              : isError
                ? 'error'
                : hasNoRows
                  ? 'empty'
                  : 'ready'
          }
          onRetry={() => refetch()}
          emptyHeading="No templates yet"
          emptyBody="Templates appear here once you create your first one."
          emptyAction={
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setCreateConflict(false);
                setAddOpen(true);
              }}
            >
              Create template
            </Button>
          }
        />
      )}

      <TemplateFormDialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setCreateConflict(false);
        }}
        mode="add"
        nameConflict={createConflict}
        onSubmit={async (values) => {
          setCreateConflict(false);
          try {
            await create.mutateAsync(values);
            setAddOpen(false);
          } catch (err) {
            if (err instanceof TemplateNameConflictError) {
              setCreateConflict(true);
              return;
            }
            throw err;
          }
        }}
      />

      <TemplateFormDialog
        open={editRow !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditRow(null);
            setUpdateConflict(false);
          }
        }}
        mode="edit"
        initialRow={editRow ?? undefined}
        nameConflict={updateConflict}
        onSubmit={async (values) => {
          if (!editRow) return;
          setUpdateConflict(false);
          try {
            await update.mutateAsync({
              id: editRow.id,
              patch: values,
              previous: editRow,
            });
            setEditRow(null);
          } catch (err) {
            if (err instanceof TemplateNameConflictError) {
              setUpdateConflict(true);
              return;
            }
            throw err;
          }
        }}
      />

      <DeleteTemplateConfirm
        open={deleteRow !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteRow(null);
        }}
        row={deleteRow}
        onConfirm={(row) => {
          remove.mutate({ row });
        }}
      />
    </div>
  );
}
