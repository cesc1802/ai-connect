import { ConversationListItem } from '@/components/chat/conversation-list-item';
import type { Conversation } from '@/schemas/conversation';

type ConversationGroupProps = {
  label: string;
  items: Conversation[];
  activeId?: string;
  onSelect?: () => void;
};

export function ConversationGroup({
  label,
  items,
  activeId,
  onSelect,
}: ConversationGroupProps) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-sidebar-foreground/70 px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </div>
      {items.map((c) => (
        <ConversationListItem
          key={c.id}
          conversation={c}
          active={c.id === activeId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
