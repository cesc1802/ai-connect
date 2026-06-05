import { cn } from "@/lib/cn";

export type StatusKey = "success" | "warning" | "error" | "info" | "default";

const STATUSES: Record<StatusKey, [string, string]> = {
  success: ["bg-green-500/15 text-green-600 dark:text-green-400", "bg-green-500"],
  warning: ["bg-yellow-500/15 text-yellow-600 dark:text-yellow-400", "bg-yellow-500"],
  error: ["bg-red-500/15 text-red-600 dark:text-red-400", "bg-red-500"],
  info: ["bg-blue-500/15 text-blue-600 dark:text-blue-400", "bg-blue-500"],
  default: ["bg-muted text-muted-foreground", "bg-muted-foreground"],
};

type Props = {
  status?: StatusKey;
  label: string;
  className?: string;
};

export function StatusBadge({ status = "default", label, className }: Props) {
  const [box, dot] = STATUSES[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", box, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}
