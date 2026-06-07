import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { TEMPLATES, TEMPLATE_CATEGORIES, type Template } from "@/lib/mock-data";

export interface TemplatePickerProps {
  // Called with the chosen template's prompt body when the user picks one.
  onPick: (body: string) => void;
}

// Compact dropdown launched from a "/" button inside the composer.
// Closes on outside click, Escape, or selection. Keeps the entire chat
// history rail free of clutter — templates live next to where the user
// is typing, not in the global sidebar.
export function TemplatePicker({ onPick }: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("Tất cả");
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      if (cat !== "Tất cả" && t.cat !== cat) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)
      );
    });
  }, [query, cat]);

  function handlePick(t: Template) {
    onPick(t.desc + "\n");
    setOpen(false);
    setQuery("");
    setCat("Tất cả");
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Chọn template"
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
          open && "border-primary/40 bg-primary/10 text-primary",
        )}
      >
        <Icon name="sparkles" className="h-3.5 w-3.5" />
        Template
        <Icon name="chevron-down" className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-[360px] rounded-xl border bg-popover text-popover-foreground shadow-md">
          <div className="border-b p-2">
            <div className="relative">
              <Icon
                name="search"
                className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
              />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm template..."
                className="h-8 w-full rounded-md border bg-background pl-7 pr-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {TEMPLATE_CATEGORIES.slice(0, 6).map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-2xs transition-colors",
                    cat === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-accent",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <ul className="max-h-72 space-y-0.5 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <li className="px-2 py-6 text-center text-2xs text-muted-foreground">
                Không có template phù hợp.
              </li>
            ) : (
              filtered.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => handlePick(t)}
                    className="flex w-full items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-accent"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon name={t.icon} className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-xs font-medium">{t.title}</p>
                        <span className="shrink-0 text-2xs text-muted-foreground">
                          {t.cat}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-2xs text-muted-foreground">
                        {t.desc}
                      </p>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
