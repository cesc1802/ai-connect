import * as React from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { XIcon } from 'lucide-react';
import { z } from 'zod';

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
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/admin/status-badge';
import type { OrgTemplateRow } from '@/schemas/admin';

const FormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  description: z.string().max(280),
  body: z.string().min(1, 'Body is required').max(8000),
});

const TAG_PATTERN = /^[a-z][a-z0-9-]{0,23}$/;

type FormValues = {
  name: string;
  description: string;
  body: string;
};

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit';
  initialRow?: OrgTemplateRow;
  onSubmit: (values: {
    name: string;
    description?: string;
    body: string;
    tags: string[];
  }) => Promise<void>;
  nameConflict?: boolean;
}

export function TemplateFormDialog({
  open,
  onOpenChange,
  mode,
  initialRow,
  onSubmit,
  nameConflict,
}: TemplateFormDialogProps) {
  const defaults: FormValues = React.useMemo(
    () => ({
      name: initialRow?.name ?? '',
      description: initialRow?.description ?? '',
      body: initialRow?.body ?? '',
    }),
    [initialRow],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema) as unknown as Resolver<FormValues>,
    defaultValues: defaults,
    mode: 'onBlur',
  });

  const [tagInput, setTagInput] = React.useState('');
  const [tags, setTags] = React.useState<string[]>(initialRow?.tags ?? []);
  const [tagError, setTagError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      form.reset(defaults);
      setTags(initialRow?.tags ?? []);
      setTagInput('');
      setTagError(null);
      setSubmitting(false);
    }
  }, [open, defaults, form, initialRow]);

  const nameId = React.useId();
  const descId = React.useId();
  const bodyId = React.useId();
  const tagsId = React.useId();
  const tagErrId = `${tagsId}-err`;

  function commitTagsFromInput(raw: string): {
    accepted: string[];
    error: string | null;
  } {
    const parts = raw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    if (parts.length === 0) return { accepted: [], error: null };
    const accepted: string[] = [];
    for (const p of parts) {
      if (!TAG_PATTERN.test(p)) {
        return {
          accepted,
          error: `Invalid tag "${p}". Use lowercase letters, digits, and hyphens; start with a letter (max 24).`,
        };
      }
      if (tags.includes(p) || accepted.includes(p)) continue;
      accepted.push(p);
    }
    if (tags.length + accepted.length > 6) {
      return { accepted: [], error: 'At most 6 tags.' };
    }
    return { accepted, error: null };
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const { accepted, error } = commitTagsFromInput(tagInput);
      if (error) {
        setTagError(error);
        return;
      }
      if (accepted.length > 0) {
        setTags((prev) => [...prev, ...accepted]);
      }
      setTagInput('');
      setTagError(null);
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  function handleTagBlur() {
    if (!tagInput.trim()) return;
    const { accepted, error } = commitTagsFromInput(tagInput);
    if (error) {
      setTagError(error);
      return;
    }
    if (accepted.length > 0) {
      setTags((prev) => [...prev, ...accepted]);
    }
    setTagInput('');
  }

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
  }

  async function handleSubmit(values: FormValues) {
    if (tagInput.trim()) {
      const { accepted, error } = commitTagsFromInput(tagInput);
      if (error) {
        setTagError(error);
        return;
      }
      if (accepted.length > 0) setTags((prev) => [...prev, ...accepted]);
      setTagInput('');
    }
    setSubmitting(true);
    try {
      await onSubmit({
        name: values.name,
        description: values.description || undefined,
        body: values.body,
        tags,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const nameErr = form.formState.errors.name?.message;
  const bodyErr = form.formState.errors.body?.message;
  const nameConflictMsg = nameConflict
    ? 'A template with this name already exists'
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="template-form-dialog" className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'add' ? 'Add template' : 'Edit template'}
          </DialogTitle>
          <DialogDescription>
            Templates are shared across the organization.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={nameId}>Name</Label>
            <Input
              id={nameId}
              aria-invalid={Boolean(nameErr || nameConflictMsg) || undefined}
              aria-describedby={
                nameErr || nameConflictMsg ? `${nameId}-err` : undefined
              }
              {...form.register('name')}
            />
            {(nameErr || nameConflictMsg) && (
              <p id={`${nameId}-err`} className="text-destructive text-xs">
                {nameConflictMsg ?? nameErr}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={descId}>Description</Label>
            <Input id={descId} {...form.register('description')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={bodyId}>Body</Label>
            <Textarea
              id={bodyId}
              className="font-mono min-h-40"
              aria-invalid={Boolean(bodyErr) || undefined}
              aria-describedby={bodyErr ? `${bodyId}-err` : undefined}
              {...form.register('body')}
            />
            {bodyErr && (
              <p id={`${bodyId}-err`} className="text-destructive text-xs">
                {bodyErr}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={tagsId}>Tags</Label>
            {tags.length > 0 && (
              <ul role="list" className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <li key={t}>
                    <StatusBadge intent="info" className="gap-1.5">
                      <span>{t}</span>
                      <button
                        type="button"
                        aria-label={`Remove tag ${t}`}
                        onClick={() => removeTag(t)}
                        className="rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <XIcon className="size-3" aria-hidden={true} />
                      </button>
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            )}
            <Input
              id={tagsId}
              placeholder="Add tag and press Enter or comma"
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                if (tagError) setTagError(null);
              }}
              onKeyDown={handleTagKeyDown}
              onBlur={handleTagBlur}
              aria-invalid={Boolean(tagError) || undefined}
              aria-describedby={tagError ? tagErrId : undefined}
            />
            {tagError && (
              <p id={tagErrId} className="text-destructive text-xs">
                {tagError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {mode === 'add' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
