import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/schemas/conversation';

type ConversationListItemProps = {
  conversation: Conversation;
  active: boolean;
  onSelect?: () => void;
};

function relativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

export function ConversationListItem({
  conversation,
  active,
  onSelect,
}: ConversationListItemProps) {
  return (
    <Link
      to="/chat/$conversationId"
      params={{ conversationId: conversation.id }}
      onClick={onSelect}
      className={cn(
        'flex flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-sidebar-foreground',
      )}
    >
      <span className="truncate">{conversation.title || 'New conversation'}</span>
      <span className="text-muted-foreground text-xs">
        {relativeTime(conversation.updatedAt)}
      </span>
    </Link>
  );
}
