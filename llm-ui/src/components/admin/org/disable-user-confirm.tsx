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

interface DisableUserConfirmProps {
  open: boolean;
  email: string;
  isPending?: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
}

export function DisableUserConfirm({
  open,
  email,
  isPending,
  errorMessage,
  onOpenChange,
  onConfirm,
}: DisableUserConfirmProps) {
  const handleConfirm = React.useCallback(async () => {
    await onConfirm();
  }, [onConfirm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="disable-user-confirm">
        <DialogHeader>
          <DialogTitle>{`Disable ${email}?`}</DialogTitle>
          <DialogDescription>
            They will lose access immediately.
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
            Disable user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
