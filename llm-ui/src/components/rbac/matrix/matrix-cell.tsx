import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';

import { RoleBadge } from '@/components/rbac/role-badge';
import { cn } from '@/lib/utils';
import type { WorkspaceRole } from '@/schemas/workspace';

interface MatrixCellProps {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole | null;
  className?: string;
}

// Phase 05 owns `/admin/org/assignment`; until that route registers in the
// route tree, navigate via an untyped href to avoid type-checking failure.
function assignmentHref(userId: string, workspaceId: string): string {
  const params = new URLSearchParams({ user: userId, workspace: workspaceId });
  return `/admin/org/assignment?${params.toString()}`;
}

export function MatrixCell({
  userId,
  workspaceId,
  role,
  className,
}: MatrixCellProps) {
  const navigate = useNavigate();

  if (role === null) {
    return (
      <span
        data-slot="matrix-cell-empty"
        aria-label="Chưa tham gia"
        className={cn(
          'text-muted-foreground inline-flex items-center justify-center text-sm',
          className,
        )}
      >
        —
      </span>
    );
  }

  const href = assignmentHref(userId, workspaceId);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    void navigate({ to: href as never });
  }

  return (
    <a
      href={href}
      data-slot="matrix-cell"
      data-user-id={userId}
      data-workspace-id={workspaceId}
      onClick={handleClick}
      className={cn(
        'focus-visible:ring-ring inline-flex items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2',
        className,
      )}
      aria-label={`Vai trò ${role}`}
    >
      <RoleBadge role={role} />
    </a>
  );
}
