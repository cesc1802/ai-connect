import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { IconTile } from "@/components/widgets/icon-tile";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import {
  useProviders,
  removeProvider,
  type Provider,
} from "@/lib/mock-data";
import { ProviderDeleteDialog } from "@/components/widgets/provider-delete-dialog";
import { ProviderCreateDialog } from "@/components/widgets/provider-create-dialog";
import { ProviderEditDialog } from "@/components/widgets/provider-edit-dialog";
import { ProviderDetailDialog } from "@/components/widgets/provider-detail-dialog";

// Single-screen CRUD for providers. All flows (create / detail / edit / delete)
// are dialogs; the URL stays at /providers throughout.
type DialogState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "detail"; provider: Provider }
  | { kind: "edit"; provider: Provider }
  | { kind: "delete"; provider: Provider };

export function ProvidersScreen() {
  const providers = useProviders();
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
  const close = () => setDialog({ kind: "closed" });

  function confirmDelete() {
    if (dialog.kind !== "delete") return;
    removeProvider(dialog.provider.id);
    close();
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Providers"
        description="Khoá LLM cấp tổ chức, dùng chung cho mọi workspace. Khoá được mã hoá AES-256-GCM."
        actions={
          <Button onClick={() => setDialog({ kind: "create" })}>
            <Icon name="plus" className="h-4 w-4" /> Thêm provider
          </Button>
        }
      />

      {providers.length === 0 ? (
        <EmptyState onAdd={() => setDialog({ kind: "create" })} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              onOpen={() => setDialog({ kind: "detail", provider: p })}
              onEdit={() => setDialog({ kind: "edit", provider: p })}
              onDelete={() => setDialog({ kind: "delete", provider: p })}
            />
          ))}
        </div>
      )}

      <ProviderCreateDialog
        open={dialog.kind === "create"}
        onClose={close}
      />
      <ProviderDetailDialog
        open={dialog.kind === "detail"}
        provider={dialog.kind === "detail" ? dialog.provider : null}
        onClose={close}
        onEdit={(p) => setDialog({ kind: "edit", provider: p })}
        onDelete={(p) => setDialog({ kind: "delete", provider: p })}
      />
      <ProviderEditDialog
        open={dialog.kind === "edit"}
        provider={dialog.kind === "edit" ? dialog.provider : null}
        onClose={close}
        onRequestDelete={(p) => setDialog({ kind: "delete", provider: p })}
      />
      <ProviderDeleteDialog
        open={dialog.kind === "delete"}
        provider={dialog.kind === "delete" ? dialog.provider : null}
        onClose={close}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// Provider summary card. Click anywhere opens the detail dialog; the footer
// buttons stop propagation so they trigger their own actions.
function ProviderCard({
  provider, onOpen, onEdit, onDelete,
}: {
  provider: Provider;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isLocal = provider.status === "local";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex flex-col gap-4 rounded-xl border bg-card p-5 text-left shadow-sm transition-all",
        "hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
      )}
    >
      {/* header */}
      <div className="flex items-center gap-3">
        <IconTile icon={provider.icon} size={40} tone="muted" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-base font-semibold">{provider.name}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
              {provider.keyLabel}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">{isLocal ? "local" : "org-level"}</div>
        </div>
        <StatusBadge
          status={isLocal ? "info" : "success"}
          label={isLocal ? "Local" : "Đã kết nối"}
        />
      </div>

      {/* key / endpoint */}
      <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
        <Icon
          name={isLocal ? "hard-drive" : "key-round"}
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
        />
        <span className="flex-1 truncate font-mono text-xs">{provider.masked}</span>
      </div>

      {/* model */}
      <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
        <Icon name="bot" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="shrink-0 text-2xs text-muted-foreground">Model</span>
        <span className="min-w-0 flex-1 truncate text-right font-mono text-xs font-medium">
          {provider.model}
        </span>
      </div>

      {/* usage */}
      <div>
        <div className="mb-1 flex items-center justify-between text-2xs text-muted-foreground">
          <span>Tỉ trọng sử dụng (org)</span>
          <span className="font-medium text-foreground">{provider.usage}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${provider.usage}%` }} />
        </div>
      </div>

      {/* actions */}
      <div className="flex gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
        >
          <Icon name="sliders-horizontal" className="h-3.5 w-3.5" /> Cấu hình
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Xoá ${provider.name}`}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Icon name="trash-2" className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card p-10 text-center">
      <IconTile icon="cpu" size={48} tone="muted" />
      <div>
        <p className="text-base font-semibold">Chưa có provider nào</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Thêm OpenAI, Anthropic, Google, hoặc một endpoint nội bộ để bắt đầu.
        </p>
      </div>
      <Button onClick={onAdd}>
        <Icon name="plus" className="h-4 w-4" /> Thêm provider
      </Button>
    </div>
  );
}
