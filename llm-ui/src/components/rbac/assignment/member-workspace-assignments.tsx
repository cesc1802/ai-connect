import { Layers, Mail, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RoleBadge } from '@/components/rbac/role-badge';
import { AssignmentRowActions } from './assignment-row-actions';
import type { OrgUserRow } from '@/schemas/admin';
import type { Workspace, WorkspaceRole } from '@/schemas/workspace';

export interface WorkspaceAssignment {
  workspace: Workspace;
  role: WorkspaceRole;
}

interface MemberWorkspaceAssignmentsProps {
  user: OrgUserRow | null;
  assignments: WorkspaceAssignment[];
  isLoading?: boolean;
  onAssignClick: () => void;
  onChangeRole: (assignment: WorkspaceAssignment) => void;
  onRemove: (assignment: WorkspaceAssignment) => void;
}

function emailInitial(email: string): string {
  return email.charAt(0).toUpperCase();
}

export function MemberWorkspaceAssignments({
  user,
  assignments,
  isLoading,
  onAssignClick,
  onChangeRole,
  onRemove,
}: MemberWorkspaceAssignmentsProps) {
  if (!user) {
    return (
      <div
        data-slot="assignment-detail-empty"
        className="text-muted-foreground flex h-full items-center justify-center p-6 text-sm"
      >
        Chọn một thành viên ở cột bên trái để xem workspace đã gán.
      </div>
    );
  }

  return (
    <section
      data-slot="assignment-detail"
      aria-label={`Phân quyền cho ${user.email}`}
      className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6"
    >
      <div className="bg-card flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center">
        <span
          aria-hidden="true"
          className="bg-muted text-muted-foreground flex h-13 w-13 shrink-0 items-center justify-center rounded-full text-lg font-medium"
        >
          {emailInitial(user.email)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{user.email}</h2>
          <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            {user.email}
          </div>
        </div>
        <Button onClick={onAssignClick}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Gán vào workspace
        </Button>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Workspace đã gán</h3>
          <span className="text-muted-foreground text-[11px]">
            {assignments.length} workspace
          </span>
        </div>

        {isLoading ? (
          <div
            className="text-muted-foreground rounded-lg border p-6 text-center text-sm"
            aria-busy="true"
          >
            Đang tải…
          </div>
        ) : assignments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
            <div className="bg-muted text-muted-foreground flex h-11 w-11 items-center justify-center rounded-xl">
              <Layers className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="text-sm font-medium">
              Chưa được gán vào workspace nào
            </div>
            <p className="text-muted-foreground max-w-xs text-xs">
              Gán {user.email} vào một workspace để cấp quyền truy cập và vai
              trò.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={onAssignClick}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Gán ngay
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {assignments.map((a) => (
              <li
                key={a.workspace.id}
                className="bg-card flex items-center gap-3 rounded-lg border p-3"
              >
                <span
                  aria-hidden="true"
                  className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-medium"
                >
                  <Layers className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {a.workspace.name}
                  </div>
                  <div className="text-muted-foreground truncate text-[11px]">
                    {a.workspace.slug}
                  </div>
                </div>
                <RoleBadge role={a.role} />
                <AssignmentRowActions
                  workspaceName={a.workspace.name}
                  onChangeRole={() => onChangeRole(a)}
                  onRemove={() => onRemove(a)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
