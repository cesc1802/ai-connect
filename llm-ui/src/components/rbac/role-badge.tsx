import * as React from 'react';

import { cn } from '@/lib/utils';
import type { WorkspaceRole } from '@/schemas/workspace';

const ROLE_CLASSES: Record<WorkspaceRole, string> = {
  owner: 'bg-primary text-primary-foreground',
  admin: 'bg-warning text-warning-foreground',
  member: 'bg-chart-2 text-primary-foreground',
  viewer: 'bg-muted text-muted-foreground',
};

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

export function roleBadgeClasses(role: WorkspaceRole): string {
  return ROLE_CLASSES[role];
}

interface RoleBadgeProps {
  role: WorkspaceRole;
  className?: string;
  children?: React.ReactNode;
}

export function RoleBadge({ role, className, children }: RoleBadgeProps) {
  return (
    <span
      data-slot="role-badge"
      data-role={role}
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        ROLE_CLASSES[role],
        className,
      )}
    >
      {children ?? ROLE_LABELS[role]}
    </span>
  );
}
