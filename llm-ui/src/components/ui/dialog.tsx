import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Icon } from "@/lib/icons";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function Dialog({ open, onClose, title, description, children, footer, className }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in-0"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        className={cn(
          "relative w-full max-w-md rounded-xl border bg-card shadow-md animate-in fade-in-0 zoom-in-95",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div className="min-w-0">
            <h2 id="dialog-title" className="text-base font-semibold">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Đóng">
            <Icon name="x" className="h-3.5 w-3.5" />
          </Button>
        </div>
        {children && <div className="px-5 pb-4">{children}</div>}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-5 py-3 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
