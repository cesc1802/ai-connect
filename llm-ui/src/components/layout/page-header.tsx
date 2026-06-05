import * as React from 'react';

import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  headingId?: string;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  headingId,
  className,
}: PageHeaderProps) {
  const generatedId = React.useId();
  const id = headingId ?? `page-header-${generatedId}`;
  return (
    <header
      data-slot="page-header"
      aria-labelledby={id}
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow ? (
          <span
            data-slot="page-header-eyebrow"
            className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide"
          >
            {eyebrow}
          </span>
        ) : null}
        <h1
          id={id}
          className="text-2xl font-semibold tracking-tight"
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div
          data-slot="page-header-actions"
          className="flex shrink-0 items-center gap-2"
        >
          {actions}
        </div>
      ) : null}
    </header>
  );
}
