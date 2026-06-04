import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { QuotaWarning } from '@/schemas/admin';

interface QuotaOverConfirmProps {
  open: boolean;
  warnings: QuotaWarning[];
  isPending?: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

export function QuotaOverConfirm({
  open,
  warnings,
  isPending,
  errorMessage,
  onOpenChange,
  onConfirm,
}: QuotaOverConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="quota-over-confirm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              aria-hidden="true"
              className="size-5 text-destructive"
            />
            Lower than current usage
          </DialogTitle>
          <DialogDescription>
            The roles below already exceed the new limits. Lower limits apply
            forward-only; in-flight requests are not blocked.
          </DialogDescription>
        </DialogHeader>
        <ul className="rounded-md border bg-muted/40 p-3 text-sm">
          {warnings.map((w) => (
            <li
              key={w.role}
              className="flex items-center justify-between py-1"
            >
              <span className="font-medium capitalize">{w.role}</span>
              <span className="text-muted-foreground">
                current usage: {w.overCount}
              </span>
            </li>
          ))}
        </ul>
        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
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
            onClick={() => void onConfirm()}
            disabled={isPending}
          >
            Apply anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
