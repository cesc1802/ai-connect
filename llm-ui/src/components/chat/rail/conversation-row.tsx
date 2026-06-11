import { cn } from "@/lib/cn";
import { Icon } from "@/lib/icons";
import type { ConversationSummary } from "@/lib/conversations-api";
import { conversationTimeLabel } from "@/lib/group-conversations-by-day";
import type { PromptTemplate } from "@/lib/workspace-templates-api";

interface ConversationRowProps {
  conversation: ConversationSummary;
  /** Seeding template, when known; legacy conversations may have none. */
  template?: PromptTemplate;
  active: boolean;
  onSelect: (id: string) => void;
}

// Single history row: template icon tile + title + category + time. Falls
// back to a generic icon (and no category) when the template is unknown.
export function ConversationRow({ conversation, template, active, onSelect }: ConversationRowProps) {
  const icon = template?.icon ?? "message-square";
  const title = conversation.title || template?.title || "Trò chuyện";
  const time = conversationTimeLabel(conversation.updatedAt);
  return (
    <button
      onClick={() => onSelect(conversation.id)}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md p-2 text-left transition-colors",
        active ? "bg-accent" : "hover:bg-accent/50",
      )}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted-foreground">
          <Icon name={icon} className="h-3 w-3 shrink-0" />
          {template && <span className="truncate">{template.category}</span>}
          <span className="shrink-0">{template ? `· ${time}` : time}</span>
        </div>
      </div>
    </button>
  );
}
