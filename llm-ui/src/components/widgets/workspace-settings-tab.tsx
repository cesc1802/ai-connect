import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Icon } from "@/lib/icons";
import { ApiError } from "@/lib/api-error";
import { slugify } from "@/lib/slugify";
import {
  updateWorkspace,
  deleteWorkspace,
  type WorkspaceSummary,
} from "@/lib/workspaces-api";

type Props = {
  workspace: WorkspaceSummary;
  onUpdated: (ws: WorkspaceSummary) => void;
  onDeleted: () => void;
};

// Settings tab ("Cấu hình") — rename/reslug form plus the destructive
// delete zone. The design prototype shows static inputs; a save row is added
// because real persistence needs an explicit submit.
export function WorkspaceSettingsTab({ workspace, onUpdated, onDeleted }: Props) {
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = name.trim() !== workspace.name || slug !== workspace.slug;
  const canSave = dirty && !!name.trim() && !!slug && !saving;

  function reset() {
    setName(workspace.name);
    setSlug(workspace.slug);
    setError(null);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateWorkspace(workspace.id, {
        ...(name.trim() !== workspace.name ? { name: name.trim() } : {}),
        ...(slug !== workspace.slug ? { slug } : {}),
      });
      onUpdated(updated);
    } catch (err) {
      if (err instanceof ApiError && err.code === "slug_taken") {
        setError("Slug hoặc ID đã tồn tại — chọn giá trị khác.");
      } else if (err instanceof ApiError && err.status === 403) {
        setError("Bạn không có quyền chỉnh sửa workspace.");
      } else {
        setError("Không thể lưu thay đổi. Thử lại sau.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteWorkspace(workspace.id);
      onDeleted();
    } catch (err) {
      setConfirming(false);
      setDeleting(false);
      setError(
        err instanceof ApiError && err.status === 403
          ? "Bạn không có quyền xóa workspace."
          : "Không thể xóa workspace. Thử lại sau.",
      );
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4 max-w-lg">
      <div className="space-y-1.5">
        <Label>Tên workspace</Label>
        <Input value={name} onChange={(e) => { setName(e.target.value); setError(null); }} />
      </div>
      <div className="space-y-1.5">
        <Label>Slug</Label>
        <Input value={slug} onChange={(e) => { setSlug(slugify(e.target.value)); setError(null); }} className="font-mono" />
      </div>

      {error && (
        <p className="flex items-center gap-1 text-2xs text-destructive">
          <Icon name="circle-alert" className="h-3 w-3" />{error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={reset} disabled={!dirty || saving}>Hủy thay đổi</Button>
        <Button onClick={save} disabled={!canSave}>Lưu thay đổi</Button>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <div>
          <div className="text-sm font-medium text-destructive">Xóa workspace</div>
          <div className="text-xs text-muted-foreground">Gỡ toàn bộ thành viên & dữ liệu.</div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
          <Icon name="trash-2" className="h-4 w-4" />Xóa
        </Button>
      </div>

      <Dialog
        open={confirming}
        onClose={() => { if (!deleting) setConfirming(false); }}
        title="Xóa workspace"
        description="Hành động này không thể hoàn tác."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>Hủy</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              <Icon name="trash-2" className="h-4 w-4" /> Xóa
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Bạn có chắc muốn xóa workspace{" "}
          <span className="font-semibold">{workspace.name}</span>? Gỡ toàn bộ
          thành viên &amp; dữ liệu.
        </p>
      </Dialog>
    </div>
  );
}
