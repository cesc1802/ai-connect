import * as React from 'react';
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type SubmitHandler,
  type Resolver,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z, ZodTypeAny } from 'zod';

import { cn } from '@/lib/utils';
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

export interface FormDialogField<T extends FieldValues> {
  name: Path<T>;
  label: string;
  description?: string;
  placeholder?: string;
  inputType?: 'text' | 'email' | 'number' | 'url';
  secret?: boolean;
  autoComplete?: string;
}

interface FormDialogProps<S extends ZodTypeAny> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  schema: S;
  fields: FormDialogField<z.infer<S>>[];
  defaultValues: DefaultValues<z.infer<S>>;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (values: z.infer<S>) => Promise<void> | void;
}

export function FormDialog<S extends ZodTypeAny>({
  open,
  onOpenChange,
  title,
  description,
  schema,
  fields,
  defaultValues,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  onSubmit,
}: FormDialogProps<S>) {
  type Values = z.infer<S> & FieldValues;
  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues,
    mode: 'onBlur',
  });

  React.useEffect(() => {
    if (open) form.reset(defaultValues);
  }, [open, defaultValues, form]);

  const handleSubmit: SubmitHandler<Values> = async (values) => {
    await onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="form-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <form
          noValidate
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-4"
        >
          {fields.map((field) => (
            <FormDialogRow key={String(field.name)} field={field} form={form} />
          ))}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface FormDialogRowProps<T extends FieldValues> {
  field: FormDialogField<T>;
  form: ReturnType<typeof useForm<T>>;
}

function FormDialogRow<T extends FieldValues>({
  field,
  form,
}: FormDialogRowProps<T>) {
  const reactId = React.useId();
  const inputId = `${reactId}-input`;
  const descId = field.description ? `${reactId}-desc` : undefined;
  const errorId = `${reactId}-err`;
  const error = form.formState.errors[field.name];
  const errorMessage =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';
  const describedBy =
    [descId, errorMessage ? errorId : null].filter(Boolean).join(' ') ||
    undefined;
  const isSecret = field.secret === true;
  const type = isSecret ? 'password' : (field.inputType ?? 'text');
  const autoComplete = field.autoComplete ?? (isSecret ? 'off' : undefined);

  return (
    <div className={cn('flex flex-col gap-1.5')}>
      <Label htmlFor={inputId}>{field.label}</Label>
      <Input
        id={inputId}
        type={type}
        placeholder={field.placeholder}
        aria-invalid={Boolean(errorMessage) || undefined}
        aria-describedby={describedBy}
        autoComplete={autoComplete}
        spellCheck={isSecret ? false : undefined}
        {...form.register(field.name)}
      />
      {field.description ? (
        <p id={descId} className="text-muted-foreground text-xs">
          {field.description}
        </p>
      ) : null}
      {errorMessage ? (
        <p id={errorId} className="text-destructive text-xs">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
