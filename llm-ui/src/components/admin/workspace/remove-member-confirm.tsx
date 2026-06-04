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

interface RemoveMemberConfirmProps {
  open: boolean;
  email: string;
  isSelf: boolean;
  isPending?: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
}

export function RemoveMemberConfirm({
  open,
  email,
  isSelf,
  isPending,
  errorMessage,
  onOpenChange,
  onConfirm,
}: RemoveMemberConfirmProps) {
  const handleConfirm = React.useCallback(async () => {
    await onConfirm();
  }, [onConfirm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="remove-member-confirm">
        <DialogHeader>
          <DialogTitle>
            {isSelf ? 'Leave this workspace?' : `Remove ${email}?`}
          </DialogTitle>
          <DialogDescription>
            {isSelf
              ? 'You will lose access to this workspace immediately.'
              : 'They will lose access to this workspace immediately.'}
          </DialogDescription>
        </DialogHeader>
        {errorMessage ? (
          <p role="alert" className="text-destructive text-sm">
            {errorMessage}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isSelf ? 'Leave workspace' : 'Remove member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
