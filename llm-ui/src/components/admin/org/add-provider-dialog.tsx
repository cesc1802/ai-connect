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
  AddOrgProviderRequest,
  type AddOrgProviderRequest as AddOrgProviderRequestType,
} from '@/schemas/admin';
import { ApiError } from '@/api/errors';
import { ProviderKind } from '@/schemas/resources';

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (values: AddOrgProviderRequestType) => Promise<void>;
}

const KIND_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  'azure-openai': 'Azure OpenAI',
  custom: 'Custom',
};

const KIND_OPTIONS = ProviderKind.options.map((kind) => ({
  value: kind,
  label: KIND_LABELS[kind] ?? kind,
}));

const DEFAULTS: AddOrgProviderRequestType = {
  displayName: '',
  providerKind: 'openai',
  apiKey: '',
};

export function AddProviderDialog({
  open,
  onOpenChange,
  onAdd,
}: AddProviderDialogProps) {
  const reactId = React.useId();
  const displayNameId = `${reactId}-displayName`;
  const displayNameErrId = `${reactId}-displayName-err`;
  const kindId = `${reactId}-kind`;
  const apiKeyId = `${reactId}-apiKey`;
  const apiKeyErrId = `${reactId}-apiKey-err`;
  const apiKeyDescId = `${reactId}-apiKey-desc`;

  const form = useForm<AddOrgProviderRequestType>({
    resolver: zodResolver(AddOrgProviderRequest),
    defaultValues: DEFAULTS,
    mode: 'onBlur',
  });

  React.useEffect(() => {
    if (open) form.reset(DEFAULTS);
  }, [open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await onAdd(values);
      // Wipe local copy of the apiKey BEFORE closing — race-free.
      form.reset(DEFAULTS);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        form.setError('displayName', {
          type: 'duplicate',
          message: 'A provider with this name already exists',
        });
        return;
      }
      form.setError('apiKey', {
        type: 'server',
        message: 'Could not add provider. Please try again.',
      });
    }
  });

  const displayErr = form.formState.errors.displayName?.message ?? '';
  const apiKeyErr = form.formState.errors.apiKey?.message ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="add-provider-dialog">
        <DialogHeader>
          <DialogTitle>Add provider</DialogTitle>
          <DialogDescription>
            Connect a new LLM provider for the organization. The API key is
            encrypted at rest and never returned to the browser after submit.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={displayNameId}>Display name</Label>
            <Input
              id={displayNameId}
              type="text"
              autoComplete="off"
              aria-invalid={Boolean(displayErr) || undefined}
              aria-describedby={displayErr ? displayNameErrId : undefined}
              {...form.register('displayName')}
            />
            {displayErr ? (
              <p
                id={displayNameErrId}
                role="alert"
                className="text-destructive text-xs"
              >
                {displayErr}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={kindId}>Provider kind</Label>
            <select
              id={kindId}
              className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
              {...form.register('providerKind')}
            >
              {KIND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={apiKeyId}>API key</Label>
            <Input
              id={apiKeyId}
              type="password"
              autoComplete="off"
              spellCheck={false}
              data-1p-ignore
              aria-invalid={Boolean(apiKeyErr) || undefined}
              aria-describedby={
                apiKeyErr
                  ? `${apiKeyDescId} ${apiKeyErrId}`
                  : apiKeyDescId
              }
              {...form.register('apiKey')}
            />
            <p id={apiKeyDescId} className="text-muted-foreground text-xs">
              Stored encrypted. Only the last four characters are ever shown.
            </p>
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
              Add provider
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
