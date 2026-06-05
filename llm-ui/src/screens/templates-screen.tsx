import { useState, useMemo } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/mock-data";

export function TemplatesScreen() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("Tất cả");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      if (cat !== "Tất cả" && t.cat !== cat) return false;
      if (!q) return true;
      return t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q);
    });
  }, [query, cat]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader
        title="Prompt Templates"
        description={`Thư viện ${TEMPLATES.length} prompts dùng chung cho toàn tổ chức`}
        actions={<Button><Icon name="plus" className="h-4 w-4" /> Tạo template</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Icon name="search" className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm template..." className="pl-8" />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TEMPLATE_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              cat === c ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <div key={t.id} className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon name={t.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{t.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{t.desc}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="rounded-full bg-muted px-2 py-0.5 text-2xs">{t.cat}</span>
              <span className="rounded-full border px-2 py-0.5 text-2xs text-muted-foreground">@{t.author}</span>
            </div>
            <div className="mt-auto flex items-center justify-between border-t pt-2 text-2xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Icon name="zap" className="h-3 w-3" /> {t.uses} lượt dùng
              </span>
              <Button variant="ghost" size="xs"><Icon name="copy" className="h-3 w-3" /> Dùng</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
