import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Icon } from "@/lib/icons";
import type { ConversationSummary } from "@/lib/conversations-api";
import { DAY_BUCKETS, groupConversationsByDay } from "@/lib/group-conversations-by-day";
import type { MyWorkspace } from "@/lib/my-workspaces-api";
import { wsShortName } from "@/lib/workspace-display-name";
import type { PromptTemplate } from "@/lib/workspace-templates-api";
import { ConversationRow } from "./conversation-row";
import { WorkspaceSwitcher } from "./workspace-switcher";

interface ChatRailProps {
  memberships: MyWorkspace[];
  activeWorkspace: MyWorkspace;
  conversations: ConversationSummary[];
  templatesById: Map<string, PromptTemplate>;
  activeConversationId: string | null;
  onSelectWorkspace: (wsId: string) => void;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
}

// Left rail: workspace switcher on top, then new-chat action and the
// conversation history of the ACTIVE workspace grouped by day.
export function ChatRail({
  memberships,
  activeWorkspace,
  conversations,
  templatesById,
  activeConversationId,
  onSelectWorkspace,
  onSelectConversation,
  onNewChat,
}: ChatRailProps) {
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const byWs: Record<string, number> = {};
    for (const c of conversations) byWs[c.workspaceId] = (byWs[c.workspaceId] || 0) + 1;
    return byWs;
  }, [conversations]);

  const scoped = useMemo(() => {
    const inWs = conversations.filter((c) => c.workspaceId === activeWorkspace.id);
    const q = query.trim().toLowerCase();
    const visible = q
      ? inWs.filter((c) => {
          const title = c.title || templatesById.get(c.templateId ?? "")?.title || "";
          return title.toLowerCase().includes(q);
        })
      : inWs;
    return [...visible].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [conversations, activeWorkspace.id, query, templatesById]);

  const groups = useMemo(() => groupConversationsByDay(scoped), [scoped]);
  const hasAnyInWs = conversations.some((c) => c.workspaceId === activeWorkspace.id);

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r bg-card md:flex">
      <div className="border-b p-3">
        <WorkspaceSwitcher memberships={memberships} activeWsId={activeWorkspace.id} counts={counts} onSelect={onSelectWorkspace} />
      </div>
      <div className="space-y-2.5 border-b p-3">
        <button onClick={onNewChat} className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          <Icon name="plus" className="h-4 w-4" />Trò chuyện mới
        </button>
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Tìm trong ${wsShortName(activeWorkspace.name)}…`} className="pl-9 h-9" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {DAY_BUCKETS.map(([key, label]) => {
          const items = groups[key];
          if (items.length === 0) return null;
          return (
            <div key={key} className="mb-3">
              <div className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
              <div className="space-y-0.5">
                {items.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conversation={c}
                    template={c.templateId ? templatesById.get(c.templateId) : undefined}
                    active={c.id === activeConversationId}
                    onSelect={onSelectConversation}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {scoped.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon name="message-square" className="h-5 w-5" /></span>
            <div className="text-xs font-medium">{hasAnyInWs ? "Không tìm thấy" : "Chưa có trò chuyện"}</div>
            <p className="text-2xs text-muted-foreground">{hasAnyInWs ? "Thử từ khoá khác." : `Bắt đầu trò chuyện mới trong ${wsShortName(activeWorkspace.name)}.`}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
