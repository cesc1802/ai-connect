import * as React from 'react';

import { cn } from '@/lib/utils';

export interface AvatarStackUser {
  id: string;
  label: string;
  color?: string;
}

interface AvatarStackProps {
  users: AvatarStackUser[];
  max?: number;
  size?: number;
  className?: string;
  ariaLabel?: string;
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function AvatarStack({
  users,
  max = 4,
  size = 28,
  className,
  ariaLabel,
}: AvatarStackProps) {
  const visible = users.slice(0, max);
  const overflow = Math.max(0, users.length - visible.length);
  const dimension = { width: size, height: size };
  return (
    <div
      data-slot="avatar-stack"
      role="list"
      aria-label={ariaLabel ?? `${users.length} member(s)`}
      className={cn('inline-flex items-center', className)}
    >
      {visible.map((user, idx) => (
        <span
          key={user.id}
          role="listitem"
          title={user.label}
          aria-label={user.label}
          style={{ ...dimension, backgroundColor: user.color }}
          className={cn(
            'border-card text-primary-foreground bg-chart-2 inline-flex items-center justify-center rounded-full border-2 text-[10px] font-semibold',
            idx > 0 && '-ml-2',
          )}
        >
          {initials(user.label)}
        </span>
      ))}
      {overflow > 0 ? (
        <span
          role="listitem"
          aria-label={`${overflow} more`}
          style={dimension}
          className={cn(
            'border-card bg-muted text-muted-foreground inline-flex items-center justify-center rounded-full border-2 text-[10px] font-semibold',
            visible.length > 0 && '-ml-2',
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
