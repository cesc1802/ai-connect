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
  RotateOrgProviderKeyRequest,
  type RotateOrgProviderKeyRequest as RotateOrgProviderKeyRequestType,
} from '@/schemas/admin';

interface RotateKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
  onRotate: (values: RotateOrgProviderKeyRequestType) => Promise<void>;
}

const DEFAULTS: RotateOrgProviderKeyRequestType = { apiKey: '' };

export function RotateKeyDialog({
  open,
  onOpenChange,
  providerName,
  onRotate,
}: RotateKeyDialogProps) {
  const reactId = React.useId();
  const apiKeyId = `${reactId}-apiKey`;
  const apiKeyErrId = `${reactId}-apiKey-err`;
  const warnId = `${reactId}-warn`;

  const form = useForm<RotateOrgProviderKeyRequestType>({
    resolver: zodResolver(RotateOrgProviderKeyRequest),
    defaultValues: DEFAULTS,
    mode: 'onBlur',
  });

  React.useEffect(() => {
    if (open) form.reset(DEFAULTS);
  }, [open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await onRotate(values);
      form.reset(DEFAULTS);
      onOpenChange(false);
    } catch {
      form.setError('apiKey', {
        type: 'server',
        message: 'Could not rotate key. Please try again.',
      });
    }
  });

  const apiKeyErr = form.formState.errors.apiKey?.message ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="rotate-key-dialog">
        <DialogHeader>
          <DialogTitle>Rotate API key</DialogTitle>
          <DialogDescription>
            Enter the new API key for <strong>{providerName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <p
            id={warnId}
            className="bg-warning text-warning-foreground rounded-md px-3 py-2 text-xs"
          >
            The previous key will be invalidated immediately on success.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={apiKeyId}>New API key</Label>
            <Input
              id={apiKeyId}
              type="password"
              autoComplete="off"
              spellCheck={false}
              data-1p-ignore
              aria-invalid={Boolean(apiKeyErr) || undefined}
              aria-describedby={
                apiKeyErr ? `${warnId} ${apiKeyErrId}` : warnId
              }
              {...form.register('apiKey')}
            />
            {apiKeyErr ? (
              <p
                id={apiKeyErrId}
                role="alert"
                className="text-destructive text-xs"
              >
                {apiKeyErr}
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
              Rotate key
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
