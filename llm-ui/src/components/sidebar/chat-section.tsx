import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate, useParams } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversations } from '@/hooks/use-conversations';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { groupConversationsByRecency } from '@/lib/conversation-grouping';
import { ConversationGroup } from './conversation-group';
import { ChatSearch } from './chat-search';
import type { Conversation } from '@/schemas/conversation';

type ChatSectionProps = {
  onItemSelect?: () => void;
};

function filterByTitle(list: Conversation[], q: string): Conversation[] {
  if (!q.trim()) return list;
  const needle = q.trim().toLowerCase();
  return list.filter((c) => (c.title ?? '').toLowerCase().includes(needle));
}

export function ChatSection({ onItemSelect }: ChatSectionProps) {
  const navigate = useNavigate();
  const workspaceId = useActiveWorkspaceStore((s) => s.activeWorkspaceId);
  const query = useConversations(workspaceId);
  const params = useParams({ strict: false }) as { conversationId?: string };
  const activeId = params.conversationId;
  const [search, setSearch] = useState('');

  const conversations = query.data?.conversations ?? [];
  const matches = useMemo(
    () => filterByTitle(conversations, search),
    [conversations, search],
  );
  const groups = useMemo(() => groupConversationsByRecency(matches), [matches]);

  function newChat(): void {
    onItemSelect?.();
    void navigate({ to: '/chat' });
  }

  const hasAny = conversations.length > 0;
  const noMatch = hasAny && matches.length === 0 && search.trim().length > 0;

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-2 p-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!hasAny) {
    return (
      <div className="flex flex-col items-start gap-2 px-3 py-3">
        <p className="text-muted-foreground text-xs">
          No conversations yet. Start one to begin.
        </p>
        <Button size="xs" variant="default" onClick={newChat}>
          <Plus className="size-3" /> New Chat
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <ChatSearch value={search} onChange={setSearch} />
      {noMatch ? (
        <div className="flex flex-col items-start gap-2 px-3 py-2">
          <p className="text-muted-foreground text-xs">
            No conversations match &ldquo;{search}&rdquo;.
          </p>
          <Button size="xs" variant="ghost" onClick={() => setSearch('')}>
            Clear search
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <ConversationGroup
            label="Today"
            items={groups.today}
            activeId={activeId}
            onSelect={onItemSelect}
          />
          <ConversationGroup
            label="Yesterday"
            items={groups.yesterday}
            activeId={activeId}
            onSelect={onItemSelect}
          />
          <ConversationGroup
            label="Last 7 days"
            items={groups.last7Days}
            activeId={activeId}
            onSelect={onItemSelect}
          />
          <ConversationGroup
            label="Older"
            items={groups.older}
            activeId={activeId}
            onSelect={onItemSelect}
          />
        </div>
      )}
    </div>
  );
}
