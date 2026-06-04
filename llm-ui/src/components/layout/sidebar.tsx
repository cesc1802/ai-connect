import { SidebarShell } from '@/components/sidebar/sidebar-shell';
import { ConversationSidebar } from '@/components/chat/conversation-sidebar';
import { WorkspaceSwitcher } from '@/components/sidebar/workspace-switcher';
import { SidebarOrgRow } from '@/components/sidebar/sidebar-org-row';
import { BackToWorkspace } from '@/components/sidebar/back-to-workspace';
import { useSidebarContext } from '@/stores/sidebar-ui-store';

type SidebarProps = {
  onItemSelect?: () => void;
  variant?: 'desktop' | 'mobile';
};

export function Sidebar({ onItemSelect, variant }: SidebarProps) {
  const context = useSidebarContext();
  const isOrg = context === 'org';

  return (
    <SidebarShell
      variant={variant}
      header={
        isOrg ? (
          <BackToWorkspace />
        ) : (
          <div className="flex flex-col gap-1">
            <WorkspaceSwitcher />
            <SidebarOrgRow />
          </div>
        )
      }
    >
      <ConversationSidebar onItemSelect={onItemSelect} />
    </SidebarShell>
  );
}
