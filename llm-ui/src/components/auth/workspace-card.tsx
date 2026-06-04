import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Workspace } from '@/schemas/workspace';

type Props = {
  workspace: Workspace;
  onSelect: (workspace: Workspace) => void;
  disabled?: boolean;
};

export function WorkspaceCard({ workspace, onSelect, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(workspace)}
      disabled={disabled}
      className={cn(
        'bg-card text-card-foreground hover:border-ring focus-visible:border-ring focus-visible:ring-ring/40',
        'flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left shadow-sm',
        'transition-colors focus-visible:ring-[3px] focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-60',
      )}
      aria-label={`Open ${workspace.name} workspace`}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{workspace.name}</span>
        <span className="text-muted-foreground text-xs capitalize">
          Role: {workspace.role}
        </span>
      </div>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </button>
  );
}
