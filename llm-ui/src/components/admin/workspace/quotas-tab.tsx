import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/admin/data-table';
import { QuotaOverConfirm } from '@/components/admin/workspace/quota-over-confirm';
import { useWsQuotas, usePatchWsQuotas } from '@/hooks/use-ws-quotas';
import type {
  PatchQuotaRow,
  QuotaWarning,
  RoleQuotaRow,
} from '@/schemas/admin';
import type { WorkspaceRole } from '@/schemas/auth';

interface DraftRow {
  role: WorkspaceRole;
  maxRequests: number;
}

export function QuotasTab() {
  const query = useWsQuotas();
  const mutation = usePatchWsQuotas();

  const [draft, setDraft] = React.useState<Map<WorkspaceRole, number> | null>(
    null,
  );
  const [pendingWarnings, setPendingWarnings] = React.useState<
    QuotaWarning[] | null
  >(null);
  const [pendingRows, setPendingRows] = React.useState<PatchQuotaRow[] | null>(
    null,
  );

  React.useEffect(() => {
    if (!mutation.isPending) {
      // server snapshot rebased — clear local drafts after a successful save.
    }
  }, [mutation.isPending]);

  const serverRows: RoleQuotaRow[] = query.data?.rows ?? [];
  const effectiveRows: DraftRow[] = serverRows.map((r) => ({
    role: r.role,
    maxRequests: draft?.get(r.role) ?? r.maxRequests,
  }));

  const dirty =
    draft !== null &&
    serverRows.some((r) => {
      const d = draft.get(r.role);
      return d !== undefined && d !== r.maxRequests;
    });

  const setRowValue = (role: WorkspaceRole, value: number) => {
    const next = new Map(draft ?? new Map<WorkspaceRole, number>());
    next.set(role, value);
    setDraft(next);
  };

  const collectChanged = (): PatchQuotaRow[] => {
    return effectiveRows
      .filter((r) => {
        const orig = serverRows.find((s) => s.role === r.role);
        return orig && orig.maxRequests !== r.maxRequests;
      })
      .map((r) => ({ role: r.role, maxRequests: r.maxRequests }));
  };

  const onSave = async () => {
    const rows = collectChanged();
    if (rows.length === 0) return;
    const result = await mutation.mutateAsync({ rows });
    if (result.warnings && result.warnings.length > 0) {
      setPendingRows(rows);
      setPendingWarnings(result.warnings);
      return;
    }
    setDraft(null);
  };

  const onConfirmForce = async () => {
    if (!pendingRows) return;
    const result = await mutation.mutateAsync({ rows: pendingRows, force: true });
    if (!result.warnings || result.warnings.length === 0) {
      setPendingRows(null);
      setPendingWarnings(null);
      setDraft(null);
    }
  };

  const onDiscard = () => {
    setDraft(null);
    setPendingRows(null);
    setPendingWarnings(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Lower limits apply forward-only; in-flight requests are never
        retroactively blocked.
      </p>
      <DataTable<DraftRow>
        caption="Per-role request quotas"
        rowKey={(r) => r.role}
        state={
          query.isLoading
            ? 'loading'
            : query.isError
              ? 'error'
              : effectiveRows.length === 0
                ? 'empty'
                : 'ready'
        }
        rows={effectiveRows}
        columns={[
          {
            key: 'role',
            header: 'Role',
            cell: (r) => <span className="capitalize">{r.role}</span>,
          },
          {
            key: 'max',
            header: 'Max requests',
            cell: (r) => (
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={r.maxRequests}
                aria-label={`Max requests for ${r.role}`}
                onChange={(e) => {
                  const next = Number.parseInt(e.target.value, 10);
                  setRowValue(
                    r.role,
                    Number.isFinite(next) && next >= 0 ? next : 0,
                  );
                }}
                className="max-w-32"
              />
            ),
          },
        ]}
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onDiscard}
          disabled={!dirty || mutation.isPending}
        >
          Discard
        </Button>
        <Button
          type="button"
          onClick={() => {
            void onSave();
          }}
          disabled={!dirty || mutation.isPending}
        >
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
      <QuotaOverConfirm
        open={pendingWarnings !== null}
        warnings={pendingWarnings ?? []}
        isPending={mutation.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingWarnings(null);
        }}
        onConfirm={onConfirmForce}
      />
    </div>
  );
}
