import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { ProviderGrid } from '@/components/rbac/providers/provider-grid';
import { AddProviderDialog } from '@/components/admin/org/add-provider-dialog';
import { RotateKeyDialog } from '@/components/admin/org/rotate-key-dialog';
import {
  useAddOrgProvider,
  useDeleteOrgProvider,
  useOrgProviders,
  useRotateOrgProviderKey,
  useToggleOrgProvider,
} from '@/hooks/use-org-providers';
import type { OrgProviderRow } from '@/schemas/admin';
import type { AddOrgProviderRequest } from '@/schemas/admin';

const DELETE_CONFIRM = 'Xoá provider này?';

function ProviderGridSkeleton() {
  return (
    <div
      data-slot="providers-skeleton"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full" />
      ))}
    </div>
  );
}

export function ProvidersPage() {
  const { data, isLoading, isError, refetch } = useOrgProviders();
  const providers = React.useMemo(() => data ?? [], [data]);

  const add = useAddOrgProvider();
  const toggle = useToggleOrgProvider();
  const rotate = useRotateOrgProviderKey();
  const remove = useDeleteOrgProvider();

  const [addOpen, setAddOpen] = React.useState(false);
  const [rotateTarget, setRotateTarget] =
    React.useState<OrgProviderRow | null>(null);

  const handleAdd = React.useCallback(
    async (values: AddOrgProviderRequest) => {
      await add.mutateAsync(values);
    },
    [add],
  );

  const handleRotate = React.useCallback(
    async (values: { apiKey: string }) => {
      if (!rotateTarget) return;
      await rotate.mutateAsync({ id: rotateTarget.id, apiKey: values.apiKey });
    },
    [rotate, rotateTarget],
  );

  const handleRotateOpenChange = React.useCallback((open: boolean) => {
    if (!open) setRotateTarget(null);
  }, []);

  const handleToggle = React.useCallback(
    (p: OrgProviderRow) => {
      toggle.mutate({ id: p.id, isEnabled: !p.isEnabled });
    },
    [toggle],
  );

  const handleDelete = React.useCallback(
    (p: OrgProviderRow) => {
      if (typeof window !== 'undefined' && !window.confirm(DELETE_CONFIRM)) {
        return;
      }
      remove.mutate(p.id);
    },
    [remove],
  );

  return (
    <main
      data-slot="providers-page"
      className="flex flex-col gap-6 p-6"
      aria-labelledby="providers-page-heading"
    >
      <PageHeader
        title="Providers"
        subtitle="Khoá API ở cấp tổ chức"
        headingId="providers-page-heading"
      />

      {isLoading ? (
        <ProviderGridSkeleton />
      ) : isError ? (
        <div
          data-slot="providers-page-error"
          role="alert"
          className="text-destructive flex flex-col items-start gap-3"
        >
          <p>Không tải được providers.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void refetch();
            }}
          >
            Thử lại
          </Button>
        </div>
      ) : providers.length === 0 ? (
        <div
          data-slot="providers-page-empty"
          className="flex flex-col items-start gap-3"
        >
          <p className="text-muted-foreground text-sm">Chưa có provider nào</p>
          <Button type="button" onClick={() => setAddOpen(true)}>
            Thêm provider
          </Button>
        </div>
      ) : (
        <ProviderGrid
          providers={providers}
          onAddProvider={() => setAddOpen(true)}
          onRotateKey={(p) => setRotateTarget(p)}
          onToggleEnabled={handleToggle}
          onDelete={handleDelete}
        />
      )}

      <AddProviderDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={handleAdd}
      />

      <RotateKeyDialog
        open={rotateTarget !== null}
        providerName={rotateTarget?.displayName ?? ''}
        onOpenChange={handleRotateOpenChange}
        onRotate={handleRotate}
      />
    </main>
  );
}

export default ProvidersPage;
