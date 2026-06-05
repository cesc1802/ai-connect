import { ChevronRight } from 'lucide-react';
import type { Template } from '@/schemas/template';

type WorkspaceTemplateGroupProps = {
  label: string;
  templates: Template[];
  onApply: (template: Template) => void;
  defaultOpen?: boolean;
};

export function WorkspaceTemplateGroup({
  label,
  templates,
  onApply,
  defaultOpen = true,
}: WorkspaceTemplateGroupProps) {
  if (templates.length === 0) return null;

  return (
    <details
      className="border-border group rounded-md border [&_summary::-webkit-details-marker]:hidden"
      open={defaultOpen}
    >
      <summary className="hover:bg-muted/60 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wide">
        <ChevronRight
          className="text-muted-foreground size-3 transition-transform group-open:rotate-90 motion-reduce:transition-none"
          aria-hidden="true"
        />
        <span className="truncate">{label}</span>
        <span className="text-muted-foreground ml-auto text-[10px] font-normal normal-case">
          {templates.length}
        </span>
      </summary>
      <ul className="flex flex-col gap-0.5 px-1 pb-2 pt-1">
        {templates.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onApply(t)}
              className="hover:bg-muted focus-visible:ring-ring/50 flex w-full items-start rounded-md px-2 py-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] motion-reduce:transition-none"
            >
              <span className="truncate">{t.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
