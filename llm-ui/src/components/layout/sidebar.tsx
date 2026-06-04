import { SidebarShell } from '@/components/sidebar/sidebar-shell';
import { WorkspaceSwitcher } from '@/components/sidebar/workspace-switcher';
import { SidebarOrgRow } from '@/components/sidebar/sidebar-org-row';
import { BackToWorkspace } from '@/components/sidebar/back-to-workspace';
import { WorkspaceSections } from '@/components/sidebar/workspace-sections';
import { OrgSections } from '@/components/sidebar/org-sections';
import { SidebarAccountMenu } from '@/components/sidebar/sidebar-account-menu';
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
      account={<SidebarAccountMenu />}
    >
      {isOrg ? <OrgSections /> : <WorkspaceSections onItemSelect={onItemSelect} />}
    </SidebarShell>
  );
}
