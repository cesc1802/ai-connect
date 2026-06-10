import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { TemplateCard } from "@/components/templates/template-card";
import { TemplateDialog } from "@/components/templates/template-dialog";
import { TemplateDeleteDialog } from "@/components/templates/template-delete-dialog";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { TEMPLATE_CATEGORIES } from "@/lib/mock-data";
import { listTemplateLibrary, type PromptTemplate } from "@/lib/workspace-templates-api";

const TPL_PAGE_SIZE = 9;

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; items: PromptTemplate[] };

type DialogState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; template: PromptTemplate }
  | { kind: "delete"; template: PromptTemplate };

export function TemplatesScreen() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
  const [cat, setCat] = useState("Tất cả");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  // Monotonic sequence guards against overlapping loads (retry clicks): only
  // the latest in-flight response may write state.
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setState({ kind: "loading" });
    try {
      const items = await listTemplateLibrary();
      if (seq === loadSeq.current) setState({ kind: "ready", items });
    } catch {
      if (seq === loadSeq.current) setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items = state.kind === "ready" ? state.items : [];
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter(
      (t) =>
        (cat === "Tất cả" || t.category === cat) &&
        (t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
    );
  }, [items, cat, query]);

  // reset to first page whenever the result set changes shape
  useEffect(() => { setPage(1); }, [cat, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / TPL_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  useEffect(() => { if (page !== current) setPage(current); }, [current, page]);
  const pageItems = filtered.slice((current - 1) * TPL_PAGE_SIZE, current * TPL_PAGE_SIZE);

  const closeDialog = () => setDialog({ kind: "closed" });

  function handleSaved(saved: PromptTemplate) {
    if (dialog.kind === "create") {
      setState((s) => (s.kind === "ready" ? { kind: "ready", items: [saved, ...s.items] } : s));
      setCat(saved.category); // surface the new template under its category (effect resets to page 1)
    } else {
      setState((s) =>
        s.kind === "ready"
          ? { kind: "ready", items: s.items.map((t) => (t.id === saved.id ? saved : t)) }
          : s,
      );
    }
    closeDialog();
  }

  function handleDeleted(id: string) {
    setState((s) =>
      s.kind === "ready" ? { kind: "ready", items: s.items.filter((t) => t.id !== id) } : s,
    );
    closeDialog();
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Thư viện Prompt Template"
        description="Mẫu prompt dùng chung toàn tổ chức — ai cũng có thể duyệt và sao chép vào agent của mình."
        actions={
          <Button onClick={() => setDialog({ kind: "create" })}>
            <Icon name="plus" className="h-4 w-4" />Tạo template
          </Button>
        }
      />

      {/* search */}
      <div className="relative max-w-md">
        <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm template…" className="pl-9" />
      </div>

      {/* category pills */}
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATE_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              cat === c
                ? "border-primary bg-primary/10 text-primary"
                : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {state.kind === "loading" && (
        <div className="rounded-xl border border-dashed bg-card/40 py-12 text-center text-sm text-muted-foreground">
          Đang tải thư viện template…
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
          <p className="text-sm font-medium text-destructive">Không tải được thư viện template.</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>Thử lại</Button>
        </div>
      )}

      {state.kind === "ready" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((t) => (
              <TemplateCard
                key={t.id}
                t={t}
                onEdit={(template) => setDialog({ kind: "edit", template })}
                onDelete={(template) => setDialog({ kind: "delete", template })}
              />
            ))}
          </div>
          {filtered.length > 0 ? (
            <Pagination page={current} pageSize={TPL_PAGE_SIZE} total={filtered.length} onPage={setPage} itemLabel="template" />
          ) : (
            <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
              Không có template phù hợp.
            </div>
          )}
        </>
      )}

      {(dialog.kind === "create" || dialog.kind === "edit") && (
        <TemplateDialog
          template={dialog.kind === "edit" ? dialog.template : undefined}
          onClose={closeDialog}
          onSaved={handleSaved}
        />
      )}
      <TemplateDeleteDialog
        open={dialog.kind === "delete"}
        template={dialog.kind === "delete" ? dialog.template : null}
        onClose={closeDialog}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
