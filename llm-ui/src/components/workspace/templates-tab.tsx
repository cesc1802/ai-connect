import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons";
import {
  attachTemplate,
  detachTemplate,
  listAttachedTemplates,
  type PromptTemplate,
} from "@/lib/workspace-templates-api";
import { WsTemplateCard } from "./ws-template-card";
import { AddTemplatesDialog } from "./add-templates-dialog";

// Templates attached to the workspace: count line, empty state, card grid,
// and the add-from-library dialog. Attach/detach are optimistic with revert.

type Props = { workspaceId: string };

export function TemplatesTab({ workspaceId }: Props) {
  const [attached, setAttached] = useState<PromptTemplate[] | null>(null);
  const [error, setError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    listAttachedTemplates(workspaceId)
      .then((list) => { if (!cancelled) setAttached(list); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [workspaceId, reload]);

  const add = async (t: PromptTemplate) => {
    await attachTemplate(workspaceId, t.id);
    setAttached((cur) => (cur ? [...cur, t] : [t]));
  };

  const remove = async (templateId: string) => {
    const prev = attached;
    setAttached((cur) => cur?.filter((t) => t.id !== templateId) ?? cur);
    try {
      await detachTemplate(workspaceId, templateId);
    } catch {
      setAttached(prev);
    }
  };

  if (error) {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-6">
        <p className="text-sm font-medium text-destructive">Không tải được danh sách template.</p>
        <Button variant="outline" size="sm" onClick={() => setReload((n) => n + 1)}>Thử lại</Button>
      </div>
    );
  }

  if (attached === null) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Đang tải templates…</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {attached.length} template gắn với workspace này. Agent trong workspace có thể dùng trực tiếp.
        </p>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Icon name="plus" className="h-4 w-4" />Thêm từ thư viện
        </Button>
      </div>
      {attached.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Icon name="scroll-text" size={20} />
          </div>
          <div className="text-sm font-medium">Chưa có template nào</div>
          <p className="max-w-xs text-xs text-muted-foreground">
            Thêm template từ thư viện chung của tổ chức để agent trong workspace sử dụng.
          </p>
          <Button variant="outline" size="sm" className="mt-1" onClick={() => setAdding(true)}>
            <Icon name="plus" className="h-4 w-4" />Thêm từ thư viện
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {attached.map((t) => (
            <WsTemplateCard key={t.id} template={t} onRemove={(id) => void remove(id)} />
          ))}
        </div>
      )}
      {adding && (
        <AddTemplatesDialog
          attachedIds={attached.map((t) => t.id)}
          onClose={() => setAdding(false)}
          onAdd={add}
        />
      )}
    </div>
  );
}
