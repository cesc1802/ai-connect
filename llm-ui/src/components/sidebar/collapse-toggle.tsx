import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useSidebarCollapsed,
  useSidebarUiStore,
} from '@/stores/sidebar-ui-store';

type CollapseToggleProps = {
  /** id of the navigation region the toggle controls (sets aria-controls). */
  controlsId?: string;
};

export function CollapseToggle({ controlsId }: CollapseToggleProps) {
  const collapsed = useSidebarCollapsed();
  const toggle = useSidebarUiStore((s) => s.toggleCollapsed);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-expanded={!collapsed}
      aria-controls={controlsId}
      onClick={toggle}
      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      {collapsed ? (
        <PanelLeftOpen className="size-4" />
      ) : (
        <PanelLeftClose className="size-4" />
      )}
    </Button>
  );
}
