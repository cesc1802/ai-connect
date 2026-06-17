import { Icon } from "@/lib/icons";
import type { UsageResponse } from "@/lib/usage-api";

// Compact, readable token counts: 1.2K / 3.4M. Guards null/NaN from the API.
function formatTokens(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

type Props = {
  data: UsageResponse | null;
  loading: boolean;
};

export function UsageSummary({ data, loading }: Props) {
  const byProvider = data?.byProvider ?? [];
  const byWorkspace = data?.byWorkspace ?? [];
  const isEmpty = !loading && byProvider.length === 0 && byWorkspace.length === 0;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Sử dụng token</h3>
        <Icon name="cpu" className="h-4 w-4 text-muted-foreground" />
      </div>

      {loading && <p className="text-xs text-muted-foreground">Đang tải dữ liệu sử dụng…</p>}

      {isEmpty && (
        <p className="text-xs text-muted-foreground">
          Chưa có dữ liệu sử dụng. Bắt đầu một cuộc trò chuyện để ghi nhận token.
        </p>
      )}

      {!loading && !isEmpty && (
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="mb-2 text-2xs font-medium uppercase text-muted-foreground">Theo provider</p>
            <div className="space-y-2">
              {byProvider.map((p) => (
                <div key={`${p.providerKind}:${p.providerId ?? "none"}`} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                  <span className="truncate text-sm font-medium">{p.providerKind}</span>
                  <span className="text-2xs text-muted-foreground">
                    ↓{formatTokens(p.inputTokens)} ↑{formatTokens(p.outputTokens)} • {formatTokens(p.totalTokens)} • {p.requestCount} lượt
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-2xs font-medium uppercase text-muted-foreground">Theo workspace</p>
            <div className="space-y-2">
              {byWorkspace.map((w) => (
                <div key={w.workspaceId} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                  <span className="truncate text-sm font-medium">{w.name}</span>
                  <span className="text-2xs text-muted-foreground">
                    ↓{formatTokens(w.inputTokens)} ↑{formatTokens(w.outputTokens)} • {formatTokens(w.totalTokens)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
