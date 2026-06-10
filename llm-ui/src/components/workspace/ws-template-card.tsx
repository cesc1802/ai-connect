import { Icon } from "@/lib/icons";
import { IconTile } from "@/components/widgets/icon-tile";
import type { PromptTemplate } from "@/lib/workspace-templates-api";

// Attached-template card; the remove (X) affordance reveals on hover.

type Props = {
  template: PromptTemplate;
  onRemove: (templateId: string) => void;
};

export function WsTemplateCard({ template, onRemove }: Props) {
  return (
    <div className="group flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <IconTile icon={template.icon} size={36} tone="primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{template.title}</div>
          <span className="text-2xs text-muted-foreground">{template.category}</span>
        </div>
        <button
          onClick={() => onRemove(template.id)}
          className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-destructive group-hover:opacity-100"
          title="Gỡ khỏi workspace"
        >
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">{template.description}</p>
      <div className="mt-auto flex items-center justify-between border-t pt-2.5">
        <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <Icon name="user" className="h-3.5 w-3.5" />
          {template.authorName}
        </span>
        <span className="flex items-center gap-1 text-2xs text-muted-foreground">
          <Icon name="zap" className="h-3 w-3" />
          {template.uses.toLocaleString("vi-VN")} lượt
        </span>
      </div>
    </div>
  );
}
