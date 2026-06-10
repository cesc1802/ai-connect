import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  listWorkspaceProviders,
  setProviderEnabled,
  type WorkspaceProvider,
} from "@/lib/workspace-providers-api";
import { WsProviderRow } from "./ws-provider-row";

// Org-inherited providers with per-workspace enable toggles. Toggle is
// optimistic: flip immediately, PATCH, revert on failure.

type Props = { workspaceId: string };

export function ProvidersTab({ workspaceId }: Props) {
  const [providers, setProviders] = useState<WorkspaceProvider[] | null>(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    listWorkspaceProviders(workspaceId)
      .then((list) => { if (!cancelled) setProviders(list); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [workspaceId, reload]);

  const toggle = async (p: WorkspaceProvider) => {
    const next = !p.enabled;
    setBusyId(p.providerId);
    setProviders((cur) =>
      cur?.map((x) => (x.providerId === p.providerId ? { ...x, enabled: next } : x)) ?? cur,
    );
    try {
      await setProviderEnabled(workspaceId, p.providerId, next);
    } catch {
      setProviders((cur) =>
        cur?.map((x) => (x.providerId === p.providerId ? { ...x, enabled: p.enabled } : x)) ?? cur,
      );
    } finally {
      setBusyId(null);
    }
  };

  if (error) {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-5">
        <p className="text-sm font-medium text-destructive">Không tải được danh sách providers.</p>
        <Button variant="outline" size="sm" onClick={() => setReload((n) => n + 1)}>Thử lại</Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="mb-3 text-sm text-muted-foreground">
        Providers kế thừa từ tổ chức. Bật/tắt cho workspace này.
      </p>
      {providers === null ? (
        <p className="text-sm text-muted-foreground">Đang tải providers…</p>
      ) : providers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có provider nào ở cấp tổ chức.</p>
      ) : (
        <div className="space-y-2">
          {providers.map((p) => (
            <WsProviderRow
              key={p.providerId}
              provider={p}
              busy={busyId === p.providerId}
              onToggle={(prov) => void toggle(prov)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
