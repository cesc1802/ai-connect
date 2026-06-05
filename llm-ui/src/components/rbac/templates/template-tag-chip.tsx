import { cn } from '@/lib/utils';

interface TemplateTagChipProps {
  tag: string;
  selected?: boolean;
  count?: number;
  onClick?: () => void;
  asButton?: boolean;
  className?: string;
}

export function TemplateTagChip({
  tag,
  selected = false,
  count,
  onClick,
  asButton = true,
  className,
}: TemplateTagChipProps) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors';
  const tone = selected
    ? 'border-primary bg-primary/10 text-primary'
    : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground';

  const content = (
    <>
      <span>{tag}</span>
      {typeof count === 'number' ? (
        <span
          data-slot="template-tag-chip-count"
          className="text-muted-foreground/70 text-2xs tabular-nums"
        >
          {count}
        </span>
      ) : null}
    </>
  );

  if (!asButton) {
    return (
      <span
        data-slot="template-tag-chip"
        data-selected={selected || undefined}
        className={cn(base, tone, className)}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-slot="template-tag-chip"
      data-selected={selected || undefined}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(base, tone, className)}
    >
      {content}
    </button>
  );
}
