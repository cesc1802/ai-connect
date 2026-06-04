import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { WorkspaceRole } from '@/schemas/auth';

interface ChangeRoleConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  fromRole: WorkspaceRole;
  toRole: WorkspaceRole;
  isSelf: boolean;
  onConfirm: () => Promise<void> | void;
}

export function ChangeRoleConfirm({
  open,
  onOpenChange,
  email,
  fromRole,
  toRole,
  isSelf,
  onConfirm,
}: ChangeRoleConfirmProps) {
  const [submitting, setSubmitting] = React.useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="change-role-confirm">
        <DialogHeader>
          <DialogTitle>Change role to {toRole}?</DialogTitle>
          <DialogDescription>
            {isSelf
              ? `You are about to change your own role from ${fromRole} to ${toRole}. You will lose admin access to this workspace.`
              : `${email} will be changed from ${fromRole} to ${toRole}.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={submitting}>
            Change role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
