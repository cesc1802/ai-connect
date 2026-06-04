import { Plus } from 'lucide-react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversations } from '@/hooks/use-conversations';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { ConversationListItem } from './conversation-list-item';

type ConversationSidebarProps = {
  onItemSelect?: () => void;
};

export function ConversationSidebar({ onItemSelect }: ConversationSidebarProps) {
  const navigate = useNavigate();
  const workspaceId = useActiveWorkspaceStore((s) => s.activeWorkspaceId);
  const conversationsQuery = useConversations(workspaceId);
  const params = useParams({ strict: false }) as { conversationId?: string };
  const activeId = params.conversationId;

  function onNewConversation(): void {
    onItemSelect?.();
    navigate({ to: '/chat' });
  }

  const conversations = conversationsQuery.data?.conversations ?? [];

  return (
    <aside
      data-slot="sidebar"
      className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-full flex-col border-r"
    >
      <div className="border-sidebar-border flex items-center justify-between gap-2 border-b px-3 py-3">
        <h2 className="text-sm font-semibold">Conversations</h2>
        <Button
          variant="default"
          size="xs"
          aria-label="New conversation"
          onClick={onNewConversation}
        >
          <Plus className="size-3" />
          New
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <nav
          aria-label="Conversation history"
          className="flex flex-col gap-0.5 px-2 py-2"
        >
          {conversationsQuery.isLoading ? (
            <div className="flex flex-col gap-2 p-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-muted-foreground px-3 py-3 text-xs">
              No conversations yet. Start a new one.
            </div>
          ) : (
            conversations.map((c) => (
              <ConversationListItem
                key={c.id}
                conversation={c}
                active={c.id === activeId}
                onSelect={onItemSelect}
              />
            ))
          )}
        </nav>
      </ScrollArea>
    </aside>
  );
}
