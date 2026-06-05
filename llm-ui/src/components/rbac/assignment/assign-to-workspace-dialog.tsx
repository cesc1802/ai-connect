import * as React from 'react';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Workspace, WorkspaceRole } from '@/schemas/workspace';

const ROLE_OPTIONS: { value: WorkspaceRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
];

interface AssignToWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userLabel: string;
  availableWorkspaces: Workspace[];
  isSubmitting?: boolean;
  onSubmit: (workspaceId: string, role: WorkspaceRole) => Promise<void> | void;
}

export function AssignToWorkspaceDialog({
  open,
  onOpenChange,
  userLabel,
  availableWorkspaces,
  isSubmitting,
  onSubmit,
}: AssignToWorkspaceDialogProps) {
  const reactId = React.useId();
  const roleId = `${reactId}-role`;

  const [wsId, setWsId] = React.useState<string | null>(null);
  const [role, setRole] = React.useState<WorkspaceRole>('member');

  React.useEffect(() => {
    if (open) {
      setWsId(availableWorkspaces[0]?.id ?? null);
      setRole('member');
    }
  }, [open, availableWorkspaces]);

  const noneAvailable = availableWorkspaces.length === 0;
  const canSubmit = !!wsId && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsId) return;
    await onSubmit(wsId, role);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="assign-to-workspace-dialog">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Gán {userLabel} vào workspace</DialogTitle>
            <DialogDescription>Chọn workspace và vai trò.</DialogDescription>
          </DialogHeader>

          {noneAvailable ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {userLabel} đã có mặt trong tất cả workspace.
            </p>
          ) : (
            <div className="space-y-4 py-2">
              <fieldset className="space-y-1.5">
                <legend className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
                  Workspace
                </legend>
                <ul
                  role="radiogroup"
                  aria-label="Workspace"
                  className="space-y-1.5"
                >
                  {availableWorkspaces.map((ws) => {
                    const checked = wsId === ws.id;
                    return (
                      <li key={ws.id}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          onClick={() => setWsId(ws.id)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors',
                            checked
                              ? 'border-primary/40 bg-primary/5'
                              : 'hover:bg-accent/40',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {ws.name}
                            </div>
                            <div className="text-muted-foreground truncate text-[11px]">
                              {ws.slug}
                            </div>
                          </div>
                          <span
                            aria-hidden="true"
                            className={cn(
                              'flex h-4 w-4 items-center justify-center rounded-full border',
                              checked
                                ? 'border-primary bg-primary'
                                : 'border-border',
                            )}
                          >
                            {checked && (
                              <span className="bg-primary-foreground h-1.5 w-1.5 rounded-full" />
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>

              <div className="space-y-1.5">
                <Label
                  htmlFor={roleId}
                  className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider"
                >
                  Vai trò
                </Label>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as WorkspaceRole)}
                >
                  <SelectTrigger id={roleId} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={!canSubmit || noneAvailable}>
              <Check className="h-4 w-4" aria-hidden="true" />
              Gán quyền
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
