import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useReturnToWorkspace } from '@/hooks/use-workspace-switch';

export function BackToWorkspace() {
  const back = useReturnToWorkspace();
  return (
    <Button
      variant="ghost"
      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full justify-start gap-2"
      onClick={back}
    >
      <ArrowLeft className="size-4" />
      <span>Back to Workspace</span>
    </Button>
  );
}
