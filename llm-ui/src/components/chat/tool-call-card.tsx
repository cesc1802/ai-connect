import { Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToolCallCardProps = {
  toolName: string;
  args?: unknown;
  result?: unknown;
  active?: boolean;
  className?: string;
};

function formatPayload(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ToolCallCard({
  toolName,
  args,
  result,
  active = false,
  className,
}: ToolCallCardProps) {
  const argsText = formatPayload(args);
  const resultText = formatPayload(result);
  const hasArgs = argsText.length > 0;
  const hasResult = resultText.length > 0;

  return (
    <div
      className={cn(
        'border-border bg-muted/40 rounded-md border',
        className,
      )}
      data-active={active || undefined}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Wrench
          className={cn(
            'text-muted-foreground size-4 shrink-0',
            active && 'animate-wobble text-foreground',
          )}
          aria-hidden="true"
        />
        <span className="font-mono text-xs font-medium">{toolName}</span>
        {active && (
          <span
            className="text-muted-foreground ml-auto text-[11px] uppercase tracking-wide"
            aria-live="polite"
          >
            Đang chạy
          </span>
        )}
      </div>
      {hasArgs && (
        <details className="border-border/60 border-t">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer px-3 py-1.5 text-xs">
            Tham số
          </summary>
          <pre className="bg-background/60 overflow-x-auto px-3 py-2 font-mono text-[11px]">
            {argsText}
          </pre>
        </details>
      )}
      {hasResult && (
        <details className="border-border/60 border-t">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer px-3 py-1.5 text-xs">
            Kết quả
          </summary>
          <pre className="bg-background/60 overflow-x-auto px-3 py-2 font-mono text-[11px]">
            {resultText}
          </pre>
        </details>
      )}
    </div>
  );
}
