import * as React from 'react';

import { EmptyState } from '@/components/admin/empty-state';

interface DataTableEmptyProps {
  heading?: string;
  body?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function DataTableEmpty({
  heading = 'No results',
  body = 'Nothing matches the current filters.',
  icon,
  action,
}: DataTableEmptyProps) {
  return (
    <EmptyState heading={heading} body={body} icon={icon} action={action} />
  );
}
