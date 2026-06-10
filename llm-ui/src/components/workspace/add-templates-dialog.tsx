import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconTile } from "@/components/widgets/icon-tile";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { TEMPLATE_CATEGORIES } from "@/lib/mock-data";
import { listTemplateLibrary, type PromptTemplate } from "@/lib/workspace-templates-api";

// Library picker: fetches the org template library once on open; search and
// category filtering happen client-side. The dialog stays open after each
// add so several templates can be attached in one pass.

type Props = {
  attachedIds: string[];
  onClose: () => void;
  onAdd: (template: PromptTemplate) => Promise<void>;
};

export function AddTemplatesDialog({ attachedIds, onClose, onAdd }: Props) {
  const [library, setLibrary] = useState<PromptTemplate[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("Tất cả");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addError, setAddError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listTemplateLibrary()
      .then((list) => { if (!cancelled) setLibrary(list); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, []);

  const pool = (library ?? [])
    .filter((t) => !attachedIds.includes(t.id))
    .filter(
      (t) =>
        (cat === "Tất cả" || t.category === cat) &&
        (t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.description.toLowerCase().includes(query.toLowerCase())),
    );

  const add = async (t: PromptTemplate) => {
    setBusyId(t.id);
    setAddError(false);
    try {
      await onAdd(t);
    } catch {
      setAddError(true);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border bg-card shadow-md">
        <div className="flex items-center gap-3 border-b p-4">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name="scroll-text" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Thêm template từ thư viện</div>
            <div className="text-xs text-muted-foreground">
              Chọn từ {library?.length ?? "…"} mẫu dùng chung của tổ chức.
            </div>
          </div>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-accent">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 border-b p-4">
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm template…" className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-2xs font-medium transition-colors",
                  cat === c
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {addError && (
          <p className="border-b px-4 py-2 text-xs text-destructive">
            Không thêm được template. Vui lòng thử lại.
          </p>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loadError ? (
            <div className="py-10 text-center text-sm text-destructive">Không tải được thư viện template.</div>
          ) : library === null ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Đang tải…</div>
          ) : pool.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Không còn template phù hợp để thêm.</div>
          ) : (
            pool.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent/40">
                <IconTile icon={t.icon} size={32} tone="muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.title}</div>
                  <div className="truncate text-2xs text-muted-foreground">{t.category} · {t.description}</div>
                </div>
                <Button size="sm" variant="outline" disabled={busyId === t.id} onClick={() => void add(t)}>
                  <Icon name="plus" className="h-3.5 w-3.5" />Thêm
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
