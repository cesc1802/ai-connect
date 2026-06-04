import { ConversationSidebar } from '@/components/chat/conversation-sidebar';

type SidebarProps = {
  onItemSelect?: () => void;
};

export function Sidebar({ onItemSelect }: SidebarProps) {
  return <ConversationSidebar onItemSelect={onItemSelect} />;
}
