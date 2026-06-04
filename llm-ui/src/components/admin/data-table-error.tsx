import { AlertTriangleIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DataTableErrorProps {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function DataTableError({
  message = 'Something went wrong while loading the data.',
  onRetry,
  retryLabel = 'Try again',
  className,
}: DataTableErrorProps) {
  return (
    <div
      data-slot="data-table-error"
      role="alert"
      className={cn(
        'text-foreground flex flex-col items-center justify-center gap-3 rounded-md border p-8 text-center',
        className,
      )}
    >
      <AlertTriangleIcon
        className="text-destructive size-6"
        aria-hidden={true}
      />
      <p className="text-sm">{message}</p>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
