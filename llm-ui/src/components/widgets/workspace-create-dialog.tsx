import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { WsEmblem } from "@/components/widgets/ws-emblem";
import { Icon } from "@/lib/icons";
import { ApiError } from "@/lib/api-error";
import { hueFromString, slugify } from "@/lib/slugify";
import { createWorkspace, type WorkspaceSummary } from "@/lib/workspaces-api";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (ws: WorkspaceSummary) => void;
};

// Create workspace — mirrors the Add Provider dialog system. Three identifying
// fields: name (human), slug (URL/API), id (system). slug auto-derives from
// name but can be overridden; the id is display-only (the server assigns the
// real primary key) and tracks the slug. A live emblem previews the result.
export function WorkspaceCreateDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [taken, setTaken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(""); setSlug(""); setSlugTouched(false);
    setTaken(false); setError(null); setSubmitting(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const id = slug ? "ws_" + slug.replace(/-/g, "_") : "";

  const onName = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
    setTaken(false);
  };
  const onSlug = (v: string) => {
    setSlug(slugify(v));
    setSlugTouched(true);
    setTaken(false);
  };

  const canCreate = !!name.trim() && !!slug && !taken && !submitting;
  const previewHue = slug ? hueFromString(slug) : 32;
  const previewWs = { name: name.trim() || "Workspace mới", key: slug || "slug", hue: previewHue };

  async function create() {
    if (!canCreate) return;
    setSubmitting(true);
    setError(null);
    try {
      const ws = await createWorkspace({ name: name.trim(), slug });
      onCreated(ws);
    } catch (err) {
      if (err instanceof ApiError && err.code === "slug_taken") {
        setTaken(true);
      } else if (err instanceof ApiError && err.status === 403) {
        setError("Bạn không có quyền tạo workspace.");
      } else {
        setError("Không thể tạo workspace. Thử lại sau.");
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-md flex-col overflow-visible rounded-xl border bg-card shadow-md">
        <div className="flex items-center gap-3 border-b p-4">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon name="layers" className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Tạo workspace</div>
            <div className="text-xs text-muted-foreground">Một dự án độc lập với thành viên và vai trò riêng</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label="Đóng"><Icon name="x" className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
            <WsEmblem ws={previewWs} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{previewWs.name}</div>
              <div className="truncate font-mono text-2xs text-muted-foreground">{id || "ws_…"}</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tên workspace</Label>
            <div className="relative">
              <Icon name="layers" className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus value={name} onChange={(e) => onName(e.target.value)} placeholder="Dự Án E-Commerce" className="pl-9" />
            </div>
            <p className="text-2xs text-muted-foreground">Tên hiển thị của dự án. Có thể chứa dấu tiếng Việt.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Slug</Label>
            <div className="relative">
              <Icon name="link" className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={slug} onChange={(e) => onSlug(e.target.value)} placeholder="e-commerce" className="pl-9 font-mono text-xs" />
            </div>
            <p className="text-2xs text-muted-foreground">Dùng trong URL & API. Chữ thường, không dấu cách — tự sinh từ tên.</p>
          </div>

          <div className="space-y-1.5">
            <Label>ID</Label>
            <div className="relative">
              <Icon name="hash" className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={id} readOnly placeholder="ws_e_commerce" className="pl-9 font-mono text-xs text-muted-foreground" />
            </div>
            <p className="text-2xs text-muted-foreground">Định danh hệ thống, không đổi sau khi tạo.</p>
          </div>

          {taken && <p className="flex items-center gap-1 text-2xs text-destructive"><Icon name="circle-alert" className="h-3 w-3" />Slug hoặc ID đã tồn tại — chọn giá trị khác.</p>}
          {error && <p className="flex items-center gap-1 text-2xs text-destructive"><Icon name="circle-alert" className="h-3 w-3" />{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t p-4">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button onClick={create} disabled={!canCreate}><Icon name="plus" className="h-4 w-4" />Tạo workspace</Button>
        </div>
      </div>
    </div>
  );
}
