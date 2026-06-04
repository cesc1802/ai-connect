import { SidebarShell } from '@/components/sidebar/sidebar-shell';
import { ConversationSidebar } from '@/components/chat/conversation-sidebar';

type SidebarProps = {
  onItemSelect?: () => void;
  variant?: 'desktop' | 'mobile';
};

/**
 * Phase 2 shell composition. Header / switcher / sections / account slots are
 * filled by later phases (3..5). Today the section region embeds the existing
 * ConversationSidebar so the chat list keeps working.
 */
export function Sidebar({ onItemSelect, variant }: SidebarProps) {
  return (
    <SidebarShell variant={variant}>
      <ConversationSidebar onItemSelect={onItemSelect} />
    </SidebarShell>
  );
}
