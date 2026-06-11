import { Icon } from "@/lib/icons";
import type { MyWorkspace } from "@/lib/my-workspaces-api";
import { wsHue } from "@/lib/workspace-hue";
import type { PromptTemplate } from "@/lib/workspace-templates-api";

interface ConversationHeaderProps {
  title: string;
  workspace: MyWorkspace;
  /** Seeding template, when known; legacy conversations may have none. */
  template?: PromptTemplate;
}

// Conversation header — shows which workspace + template you're in.
export function ConversationHeader({ title, workspace, template }: ConversationHeaderProps) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon name={template?.icon ?? "message-square"} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold leading-tight">{title}</span>
          {template && (
            <span className="shrink-0 whitespace-nowrap rounded-full border bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">{template.category}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `oklch(0.62 0.15 ${wsHue(workspace.id)})` }} />
          <span className="truncate">{workspace.name}{template ? ` · mẫu “${template.title}”` : ""}</span>
        </div>
      </div>
    </div>
  );
}
