import * as React from 'react';

import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  heading: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  heading,
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      role="status"
      className={cn(
        'text-foreground flex flex-col items-center justify-center gap-3 rounded-md border p-8 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="text-muted-foreground" aria-hidden={true}>
          {icon}
        </div>
      ) : null}
      <h2 className="text-base font-semibold">{heading}</h2>
      {body ? (
        <p className="text-muted-foreground text-sm">{body}</p>
      ) : null}
      {action}
    </div>
  );
}
