import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Icon } from "@/lib/icons";
import type { MyWorkspace } from "@/lib/my-workspaces-api";
import { wsHue } from "@/lib/workspace-hue";
import { wsShortName } from "@/lib/workspace-display-name";
import { listAttachedTemplates, type PromptTemplate } from "@/lib/workspace-templates-api";

interface NewChatDialogProps {
  workspace: MyWorkspace;
  onPick: (wsId: string, templateId: string) => void;
  onClose: () => void;
}

// Step 2 of the chat flow: every new conversation starts from a prompt
// template attached to the active workspace.
export function NewChatDialog({ workspace, onPick, onClose }: NewChatDialogProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAttachedTemplates(workspace.id)
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspace.id]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? templates.filter((t) => t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
    : templates;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border bg-card shadow-md">
        <div className="flex items-center gap-3 border-b p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: `oklch(0.62 0.15 ${wsHue(workspace.id)})` }}>{wsShortName(workspace.name)[0]}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Trò chuyện mới</div>
            <div className="truncate text-xs text-muted-foreground">Chọn mẫu prompt từ {wsShortName(workspace.name)}</div>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b p-3">
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm mẫu trong workspace…" className="h-9 pl-9" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">Đang tải mẫu prompt…</p>
          ) : visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">Không có mẫu phù hợp trong workspace này.</p>
          ) : (
            visible.map((t) => (
              <button key={t.id} onClick={() => onPick(workspace.id, t.id)} className="flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon name={t.icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.title}</div>
                  <div className="truncate text-2xs text-muted-foreground">{t.category} · {t.description}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
