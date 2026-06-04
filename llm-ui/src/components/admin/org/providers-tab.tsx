import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  DataTable,
  type DataTableColumn,
  type DataTableState,
} from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
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

const KIND_LABEL: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  'azure-openai': 'Azure OpenAI',
  custom: 'Custom',
};

function formatLastFour(row: OrgProviderRow): string {
  if (!row.hasKey || !row.lastFour) return '—';
  return `••••${row.lastFour}`;
}

export function ProvidersTab() {
  const { data, isLoading, isError, refetch } = useOrgProviders();
  const rows = React.useMemo(() => data ?? [], [data]);

  const add = useAddOrgProvider();
  const toggle = useToggleOrgProvider();
  const rotate = useRotateOrgProviderKey();
  const remove = useDeleteOrgProvider();

  const [addOpen, setAddOpen] = React.useState(false);
  const [rotateTarget, setRotateTarget] = React.useState<OrgProviderRow | null>(
    null,
  );
  const rotateTriggerRef = React.useRef<HTMLButtonElement | null>(null);

  const handleAdd = React.useCallback(
    async (values: Parameters<typeof add.mutateAsync>[0]) => {
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
    if (!open) {
      setRotateTarget(null);
      rotateTriggerRef.current?.focus();
    }
  }, []);

  const state: DataTableState = isError
    ? 'error'
    : isLoading
      ? 'loading'
      : rows.length === 0
        ? 'empty'
        : 'ready';

  const columns: DataTableColumn<OrgProviderRow>[] = React.useMemo(
    () => [
      {
        key: 'displayName',
        header: 'Provider',
        cell: (row) => row.displayName,
      },
      {
        key: 'providerKind',
        header: 'Kind',
        cell: (row) => KIND_LABEL[row.providerKind] ?? row.providerKind,
      },
      {
        key: 'isEnabled',
        header: 'Status',
        cell: (row) =>
          row.isEnabled ? (
            <StatusBadge intent="active">Enabled</StatusBadge>
          ) : (
            <StatusBadge intent="disabled">Disabled</StatusBadge>
          ),
      },
      {
        key: 'lastFour',
        header: 'Key',
        cell: (row) => (
          <code className="font-mono text-xs">{formatLastFour(row)}</code>
        ),
      },
      {
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        cell: (row) => (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                toggle.mutate({ id: row.id, isEnabled: !row.isEnabled })
              }
            >
              {row.isEnabled ? 'Disable' : 'Enable'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={(e) => {
                rotateTriggerRef.current = e.currentTarget;
                setRotateTarget(row);
              }}
            >
              Rotate key
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => remove.mutate(row.id)}
            >
              Remove
            </Button>
          </div>
        ),
      },
    ],
    [toggle, remove],
  );

  return (
    <section
      data-slot="providers-tab"
      className="flex flex-col gap-4"
      aria-labelledby="providers-tab-heading"
    >
      <header className="flex items-center justify-between gap-4">
        <h2 id="providers-tab-heading" className="text-base font-semibold">
          Org providers
        </h2>
        <Button
          type="button"
          onClick={() => setAddOpen(true)}
          data-testid="providers-tab-add-trigger"
        >
          Add provider
        </Button>
      </header>

      <DataTable
        caption="Organization LLM providers"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        state={state}
        emptyHeading="No providers yet"
        emptyBody="Add a provider to make LLM endpoints available to workspaces."
        errorMessage="Could not load providers."
        onRetry={() => {
          void refetch();
        }}
      />

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
    </section>
  );
}

export default ProvidersTab;
