import { cn } from '@/lib/utils';

type Props = {
  id: string;
  message?: string;
  className?: string;
};

export function FormFieldError({ id, message, className }: Props) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn('text-destructive text-sm', className)}
    >
      {message}
    </p>
  );
}
