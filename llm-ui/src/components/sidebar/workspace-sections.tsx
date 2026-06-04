import { useNavigate } from '@tanstack/react-router';
import { MessageSquare, FileText, Cog, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SidebarSection } from './sidebar-section';
import { ChatSection } from './chat-section';
import { TemplatesSection } from './templates-section';
import { WorkspaceSettingsNav } from './workspace-settings-nav';
import { useRouterSession } from '@/hooks/use-router-session';

type WorkspaceSectionsProps = {
  onItemSelect?: () => void;
};

export function WorkspaceSections({ onItemSelect }: WorkspaceSectionsProps) {
  const navigate = useNavigate();
  const session = useRouterSession();
  const role = session?.workspaceRole ?? null;
  const showSettings = role === 'admin' || role === 'owner';

  function onNewChat(): void {
    onItemSelect?.();
    void navigate({ to: '/chat' });
  }

  return (
    <>
      <SidebarSection
        title="Chat"
        icon={MessageSquare}
        headerAction={
          <Button
            variant="ghost"
            size="icon"
            aria-label="New chat"
            onClick={onNewChat}
            className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground size-6"
          >
            <Plus className="size-3.5" />
          </Button>
        }
      >
        <ChatSection onItemSelect={onItemSelect} />
      </SidebarSection>
      <SidebarSection title="Templates" icon={FileText}>
        <TemplatesSection />
      </SidebarSection>
      {showSettings ? (
        <SidebarSection title="Workspace Settings" icon={Cog}>
          <WorkspaceSettingsNav />
        </SidebarSection>
      ) : null}
    </>
  );
}
