import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { OrgTemplateRow } from '@/schemas/admin';

interface DeleteTemplateConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: OrgTemplateRow | null;
  onConfirm: (row: OrgTemplateRow) => void;
}

export function DeleteTemplateConfirm({
  open,
  onOpenChange,
  row,
  onConfirm,
}: DeleteTemplateConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="delete-template-confirm">
        <DialogHeader>
          <DialogTitle>Delete template?</DialogTitle>
          <DialogDescription>
            {row
              ? `"${row.name}" will be removed from the organization library.`
              : 'This template will be removed from the organization library.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (row) onConfirm(row);
              onOpenChange(false);
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
