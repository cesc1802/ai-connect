import { cn } from "@/lib/cn";
import { Icon } from "@/lib/icons";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  /** Noun after the total in the range label, e.g. "workspace". */
  itemLabel?: string;
};

// Pagination — range label + numbered pages + prev/next. Matches the app's
// muted/border button vocabulary. Always visible so the page footer reads as a
// stable shelf; numbers/arrows disable gracefully when there's a single page.
export function Pagination({ page, pageSize, total, onPage, itemLabel = "workspace" }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const go = (p: number) => onPage(Math.min(totalPages, Math.max(1, p)));
  const cls = (active: boolean, disabled: boolean) =>
    cn(
      "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md border px-2 text-sm font-medium transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-accent",
      disabled && "pointer-events-none opacity-40",
    );
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        Hiển thị <span className="font-medium text-foreground">{from}–{to}</span> trong{" "}
        <span className="font-medium text-foreground">{total}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => go(page - 1)} disabled={page <= 1} className={cls(false, page <= 1)} aria-label="Trang trước">
          <Icon name="chevron-left" className="h-4 w-4" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button key={p} type="button" onClick={() => go(p)} className={cls(p === page, false)} aria-current={p === page ? "page" : undefined}>{p}</button>
        ))}
        <button type="button" onClick={() => go(page + 1)} disabled={page >= totalPages} className={cls(false, page >= totalPages)} aria-label="Trang sau">
          <Icon name="chevron-right" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
