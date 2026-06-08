import { useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { IconTile } from "@/components/widgets/icon-tile";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { catalogByKey, type Provider } from "@/lib/mock-data";

type Props = {
  open: boolean;
  provider: Provider | null;
  onClose: () => void;
  onEdit?: (p: Provider) => void;
  onDelete?: (p: Provider) => void;
};

export function ProviderDetailDialog({ open, provider, onClose, onEdit, onDelete }: Props) {
  const [revealed, setRevealed] = useState(false);
  if (!provider) return null;
  const isLocal = provider.status === "local";
  const catalog = catalogByKey(provider.providerKey);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2.5">
          <IconTile icon={provider.icon} size={32} tone="primary" />
          <span className="text-base font-semibold">{provider.name}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
            {provider.keyLabel}
          </span>
        </span>
      }
      description={
        <span className="inline-flex items-center gap-2">
          <StatusBadge
            status={isLocal ? "info" : "success"}
            label={isLocal ? "Local" : "Đã kết nối"}
          />
          <span className="text-muted-foreground">
            · {isLocal ? "Endpoint nội bộ" : "Khoá tổ chức"}
          </span>
        </span>
      }
      className="max-w-lg"
      footer={
        <>
          <Button
            variant="ghost"
            className="mr-auto text-destructive hover:text-destructive"
            onClick={() => onDelete?.(provider)}
          >
            <Icon name="trash-2" className="h-4 w-4" /> Xoá
          </Button>
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
          <Button onClick={() => onEdit?.(provider)}>
            <Icon name="square-pen" className="h-4 w-4" /> Cấu hình
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatTile icon="cpu" label="Model" value={provider.model} mono />
          <StatTile
            icon="layers"
            label="Phạm vi"
            value={provider.scope === "org" ? "Toàn tổ chức" : "Chọn ws"}
          />
          <StatTile icon="chart-line" label="Sử dụng" value={`${provider.usage}%`}>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${provider.usage}%` }} />
            </div>
          </StatTile>
        </div>

        {/* connection */}
        <Card title="Kết nối">
          <Row icon="globe" label="Host / Endpoint">
            <code className="block truncate font-mono text-xs">{provider.host}</code>
          </Row>
          <Row
            icon={isLocal ? "hard-drive" : "key-round"}
            label={isLocal ? "Endpoint" : "API Key"}
            action={!isLocal ? (
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                className="text-2xs font-medium text-primary hover:underline"
              >
                {revealed ? "Ẩn" : "Hiện"}
              </button>
            ) : undefined}
          >
            <code className="block truncate font-mono text-xs">
              {isLocal ? provider.host : (revealed ? "sk-live-2f9a4c71e6b8d053" : provider.masked)}
            </code>
          </Row>
        </Card>

        {/* available models */}
        {catalog && catalog.models.length > 0 && (
          <Card title="Models khả dụng">
            <div className="flex flex-wrap gap-1.5">
              {catalog.models.map((m) => (
                <span
                  key={m}
                  className={cn(
                    "rounded-md border bg-background px-2 py-0.5 font-mono text-2xs",
                    m === provider.model && "border-primary/40 bg-primary/5 text-primary",
                  )}
                >
                  {m}
                </span>
              ))}
            </div>
          </Card>
        )}
      </div>
    </Dialog>
  );
}

function StatTile({
  icon, label, value, mono, children,
}: {
  icon: string;
  label: string;
  value: string;
  mono?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background p-2.5">
      <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
        <Icon name={icon} className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <div className={cn("mt-1 truncate text-sm font-semibold", mono && "font-mono text-xs")}>
        {value}
      </div>
      {children}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-background/40 p-3">
      <h3 className="mb-2 text-2xs uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({
  icon, label, action, children,
}: {
  icon: string;
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border bg-card p-2.5">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-muted-foreground">
          <Icon name={icon} className="h-3 w-3" /> {label}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
