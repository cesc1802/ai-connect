import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";

const VARIANTS: Record<BadgeVariant, string> = {
  default: "bg-primary text-primary-foreground border-transparent",
  secondary: "bg-secondary text-secondary-foreground border-transparent",
  destructive: "bg-destructive text-white border-transparent",
  outline: "border-border text-foreground",
  success: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20",
  warning: "bg-amber-500/15 text-amber-700 border-amber-500/25 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20",
  info: "bg-sky-500/15 text-sky-700 border-sky-500/25 dark:text-sky-400 dark:bg-sky-500/10 dark:border-sky-500/20",
};

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children?: ReactNode;
};

export function Badge({ variant = "default", className = "", children, ...props }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap [&>svg]:size-3 overflow-hidden",
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
