import { MatrixCell } from './matrix-cell';
import { cn } from '@/lib/utils';
import type { OrgUserRow } from '@/schemas/admin';
import type { Workspace, WorkspaceRole } from '@/schemas/workspace';

interface MatrixTableProps {
  users: OrgUserRow[];
  workspaces: Workspace[];
  getRole: (userId: string, workspaceId: string) => WorkspaceRole | null;
  className?: string;
}

function initials(email: string): string {
  const local = email.split('@')[0] ?? email;
  const parts = local.split(/[._-]/).slice(0, 2);
  return (
    parts.map((p) => p[0]?.toUpperCase() ?? '').join('').slice(0, 2) || '?'
  );
}

export function MatrixTable({
  users,
  workspaces,
  getRole,
  className,
}: MatrixTableProps) {
  return (
    <div
      data-slot="matrix-scroll"
      className={cn(
        'bg-card overflow-x-auto rounded-xl border',
        className,
      )}
    >
      <table
        data-slot="matrix-table"
        className="w-full border-collapse"
        aria-label="Ma trận phân quyền"
      >
        <thead>
          <tr className="bg-muted/60">
            <th
              scope="col"
              data-slot="matrix-corner"
              className="bg-muted/60 text-muted-foreground sticky left-0 top-0 z-20 min-w-[200px] px-4 py-3 text-left text-xs font-medium"
            >
              Thành viên
            </th>
            {workspaces.map((ws) => (
              <th
                key={ws.id}
                scope="col"
                data-slot="matrix-col-head"
                data-workspace-id={ws.id}
                className="text-foreground sticky top-0 z-10 min-w-[160px] border-l px-3 py-3 text-center text-sm font-semibold"
              >
                <div className="md:[writing-mode:horizontal-tb] lg:[writing-mode:horizontal-tb]">
                  {ws.name}
                </div>
                <div className="text-muted-foreground mt-0.5 text-[10px] font-normal">
                  {ws.slug}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-t">
              <th
                scope="row"
                data-slot="matrix-row-head"
                data-user-id={user.id}
                className="bg-card sticky left-0 z-10 px-4 py-2 text-left font-normal"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="bg-chart-2 text-primary-foreground inline-flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold"
                  >
                    {initials(user.email)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {user.email}
                    </div>
                    <div className="text-muted-foreground truncate text-[10px]">
                      {user.status}
                    </div>
                  </div>
                </div>
              </th>
              {workspaces.map((ws) => (
                <td
                  key={ws.id}
                  data-slot="matrix-body-cell"
                  className="border-l px-3 py-2 text-center align-middle"
                >
                  <MatrixCell
                    userId={user.id}
                    workspaceId={ws.id}
                    role={getRole(user.id, ws.id)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
