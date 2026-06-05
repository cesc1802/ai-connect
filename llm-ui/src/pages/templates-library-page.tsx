import * as React from 'react';
import { PlusIcon, SearchIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableSkeleton } from '@/components/admin/data-table-skeleton';
import { TemplateFilterSidebar } from '@/components/rbac/templates/template-filter-sidebar';
import { TemplateGrid } from '@/components/rbac/templates/template-grid';
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

function filterRows(
  rows: OrgTemplateRow[],
  query: string,
  selectedTags: string[],
): OrgTemplateRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    const matchesQuery =
      !q ||
      r.name.toLowerCase().includes(q) ||
      (r.description ?? '').toLowerCase().includes(q);
    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.some((t) => r.tags.includes(t));
    return matchesQuery && matchesTags;
  });
}

export function TemplatesLibraryPage() {
  const { data: rows, isLoading, isError, refetch } = useOrgTemplates();
  const create = useCreateOrgTemplate();
  const update = useUpdateOrgTemplate();
  const remove = useDeleteOrgTemplate();

  const [query, setQuery] = React.useState('');
  const debouncedQuery = useDebouncedValue(query, 150);
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState<OrgTemplateRow | null>(null);
  const [deleteRow, setDeleteRow] = React.useState<OrgTemplateRow | null>(null);
  const [createConflict, setCreateConflict] = React.useState(false);
  const [updateConflict, setUpdateConflict] = React.useState(false);

  const allRows = rows ?? [];
  const filtered = React.useMemo(
    () => filterRows(allRows, debouncedQuery, selectedTags),
    [allRows, debouncedQuery, selectedTags],
  );

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function resetFilters() {
    setSelectedTags([]);
  }

  function openCreate() {
    setCreateConflict(false);
    setAddOpen(true);
  }

  const showEmptyAll = !isLoading && !isError && allRows.length === 0;
  const showEmptyFilter =
    !isLoading && !isError && allRows.length > 0 && filtered.length === 0;
  const total = allRows.length;
  const visible = filtered.length;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Thư viện Prompt Template"
        subtitle="50 mẫu prompt dùng chung toàn tổ chức — ai cũng có thể duyệt và sao chép vào agent của mình."
        actions={
          <Button type="button" onClick={openCreate}>
            <PlusIcon className="size-4" aria-hidden={true} />
            Tạo template
          </Button>
        }
      />

      <div className="relative max-w-md">
        <label htmlFor="templates-library-search" className="sr-only">
          Tìm template
        </label>
        <SearchIcon
          className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden={true}
        />
        <Input
          id="templates-library-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm template…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <DataTableSkeleton columnCount={3} rowCount={3} />
      ) : isError ? (
        <EmptyState
          heading="Không tải được template"
          body="Đã có lỗi xảy ra khi tải danh sách template."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              Thử lại
            </Button>
          }
        />
      ) : showEmptyAll ? (
        <EmptyState
          heading="Chưa có template nào"
          body="Tạo template đầu tiên để chia sẻ với cả tổ chức."
          action={
            <Button type="button" size="sm" onClick={openCreate}>
              Tạo template
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <TemplateFilterSidebar
            rows={allRows}
            selected={selectedTags}
            onToggle={toggleTag}
            onReset={resetFilters}
            className="md:w-60 md:shrink-0"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {showEmptyFilter ? (
              <div
                data-slot="templates-library-empty-filter"
                role="status"
                className="text-muted-foreground rounded-xl border border-dashed py-12 text-center text-sm"
              >
                Không có template phù hợp.
              </div>
            ) : (
              <>
                <TemplateGrid
                  rows={filtered}
                  onEdit={(row) => {
                    setUpdateConflict(false);
                    setEditRow(row);
                  }}
                  onDelete={(row) => setDeleteRow(row)}
                />
                <div
                  data-slot="templates-library-count"
                  className="text-muted-foreground flex items-center justify-center gap-2 pt-1 text-xs"
                >
                  <span className="bg-border h-px w-12" />
                  Hiển thị {visible} / {total} template
                  <span className="bg-border h-px w-12" />
                </div>
              </>
            )}
          </div>
        </div>
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
          setDeleteRow(null);
        }}
      />
    </div>
  );
}
