import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  InviteOrgUserRequest,
  type InviteOrgUserRequest as InviteOrgUserRequestType,
} from '@/schemas/admin';
import { ApiError } from '@/api/errors';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (values: InviteOrgUserRequestType) => Promise<void>;
}

export function InviteUserDialog({
  open,
  onOpenChange,
  onInvite,
}: InviteUserDialogProps) {
  const reactId = React.useId();
  const inputId = `${reactId}-email`;
  const errorId = `${reactId}-err`;

  const form = useForm<InviteOrgUserRequestType>({
    resolver: zodResolver(InviteOrgUserRequest),
    defaultValues: { email: '' },
    mode: 'onBlur',
  });

  React.useEffect(() => {
    if (open) form.reset({ email: '' });
  }, [open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await onInvite(values);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        form.setError('email', {
          type: 'duplicate',
          message: 'A pending invite already exists for this email',
        });
        return;
      }
      if (err instanceof ApiError && err.status === 400) {
        form.setError('email', {
          type: 'invalid',
          message: 'Enter a valid email',
        });
        return;
      }
      form.setError('email', {
        type: 'server',
        message: 'Could not send invite. Please try again.',
      });
    }
  });

  const error = form.formState.errors.email;
  const errorMessage = error?.message ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="invite-user-dialog">
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>
            They will receive an invitation email and appear as pending until
            they accept.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={inputId}>Email</Label>
            <Input
              id={inputId}
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errorMessage) || undefined}
              aria-describedby={errorMessage ? errorId : undefined}
              {...form.register('email')}
            />
            {errorMessage ? (
              <p id={errorId} role="alert" className="text-destructive text-xs">
                {errorMessage}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Invite user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
