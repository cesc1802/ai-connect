import { Icon } from "@/lib/icons";
import type { PromptTemplate } from "@/lib/workspace-templates-api";

// Intro card at the top of a fresh conversation, describing the seeding
// template (shown while the thread has at most one message).
export function TemplateInfoCard({ template }: { template: PromptTemplate }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon name={template.icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0 text-sm">
        <div className="font-medium">{template.title}</div>
        <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>
        <div className="mt-2 flex items-center gap-2 text-2xs text-muted-foreground">
          {template.authorName && (
            <span className="flex items-center gap-1"><Icon name="user" className="h-3 w-3" />{template.authorName}</span>
          )}
          <span className="flex items-center gap-1"><Icon name="zap" className="h-3 w-3" />{template.uses.toLocaleString("vi-VN")} lượt dùng</span>
        </div>
      </div>
    </div>
  );
}
