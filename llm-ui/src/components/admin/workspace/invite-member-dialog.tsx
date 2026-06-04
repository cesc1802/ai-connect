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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkspaceRole } from '@/schemas/auth';
import {
  InviteWsMemberRequest,
  type InviteWsMemberRequest as InviteWsMemberRequestType,
} from '@/schemas/admin';
import { ApiError } from '@/api/errors';

const ROLE_OPTIONS: { value: WorkspaceRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
];

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (values: InviteWsMemberRequestType) => Promise<void>;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  onInvite,
}: InviteMemberDialogProps) {
  const reactId = React.useId();
  const emailId = `${reactId}-email`;
  const roleId = `${reactId}-role`;
  const errorId = `${reactId}-err`;

  const form = useForm<InviteWsMemberRequestType>({
    resolver: zodResolver(InviteWsMemberRequest),
    defaultValues: { email: '', role: 'member' },
    mode: 'onBlur',
  });

  React.useEffect(() => {
    if (open) form.reset({ email: '', role: 'member' });
  }, [open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await onInvite(values);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        form.setError('email', {
          type: 'duplicate',
          message: 'A member with this email already exists',
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
  const role = form.watch('role');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="invite-member-dialog">
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            They will be added to this workspace with the selected role.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={emailId}>Email</Label>
            <Input
              id={emailId}
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={roleId}>Role</Label>
            <Select
              value={role}
              onValueChange={(value) =>
                form.setValue('role', value as WorkspaceRole, {
                  shouldDirty: true,
                })
              }
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
              Invite member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
