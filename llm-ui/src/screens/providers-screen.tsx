import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons";
import { PROVIDERS } from "@/lib/mock-data";

export function ProvidersScreen() {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader
        title="Providers"
        description="Quản lý các nhà cung cấp mô hình AI và khoá API ở cấp tổ chức"
        actions={<Button><Icon name="plus" className="h-4 w-4" /> Thêm provider</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {PROVIDERS.map((p) => {
          const isShown = revealed[p.id];
          return (
            <div key={p.id} className="space-y-4 rounded-xl border bg-card p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon name={p.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold">{p.name}</p>
                  <p className="text-2xs text-muted-foreground">{p.status === "connected" ? "Đã kết nối" : "Cục bộ"}</p>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </div>

              <div>
                <p className="text-2xs uppercase tracking-wider text-muted-foreground">Models</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {p.models.map((m) => (
                    <span key={m} className="rounded-md border bg-background px-2 py-0.5 font-mono text-2xs">{m}</span>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-2xs uppercase tracking-wider text-muted-foreground">API Key · {p.keyLabel}</p>
                <div className="flex items-center gap-2 rounded-md border bg-background p-2">
                  <Icon name="key-round" className="h-3.5 w-3.5 text-muted-foreground" />
                  <code className="flex-1 truncate font-mono text-xs">{isShown ? p.masked : "•".repeat(20)}</code>
                  <Button variant="ghost" size="icon-xs" onClick={() => setRevealed((r) => ({ ...r, [p.id]: !r[p.id] }))}>
                    <Icon name={isShown ? "x" : "key-round"} className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon-xs"><Icon name="copy" className="h-3 w-3" /></Button>
                </div>
              </div>

              <div>
                <p className="text-2xs uppercase tracking-wider text-muted-foreground">Sử dụng tháng này</p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${p.usage}%` }} />
                </div>
                <p className="mt-1 text-2xs text-muted-foreground">{p.usage}% hạn mức</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
