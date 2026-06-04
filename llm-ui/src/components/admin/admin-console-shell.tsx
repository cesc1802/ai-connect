import * as React from 'react';

import { cn } from '@/lib/utils';

interface AdminConsoleShellProps {
  title: string;
  description?: string;
  headingId?: string;
  children: React.ReactNode;
  className?: string;
}

export function AdminConsoleShell({
  title,
  description,
  headingId,
  children,
  className,
}: AdminConsoleShellProps) {
  const generatedId = React.useId();
  const id = headingId ?? `admin-console-${generatedId}`;
  return (
    <section
      data-slot="admin-console-shell"
      aria-labelledby={id}
      className={cn(
        'text-foreground flex flex-col gap-6 p-6',
        className,
      )}
    >
      <header className="flex flex-col gap-1">
        <h1 id={id} className="text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
