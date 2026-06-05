import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/widgets/avatar";
import { RoleBadge } from "@/components/widgets/role-badge";
import { WsEmblem } from "@/components/widgets/ws-emblem";
import { USERS, WORKSPACES } from "@/lib/mock-data";

export function MatrixScreen() {
  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <PageHeader title="Ma trận truy cập" description="Tổng hợp vai trò của từng thành viên trên từng workspace" />

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-left text-2xs uppercase tracking-wider text-muted-foreground">Thành viên</th>
              {WORKSPACES.map((ws) => (
                <th key={ws.id} className="px-4 py-3 text-left text-2xs uppercase tracking-wider text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <WsEmblem ws={ws} size={24} />
                    <span className="font-medium normal-case text-foreground/80">{ws.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {USERS.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="sticky left-0 z-10 bg-card px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar user={u} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{u.name}</p>
                      <p className="truncate text-2xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </td>
                {WORKSPACES.map((ws) => {
                  const m = ws.members.find((mm) => mm.uid === u.id);
                  return (
                    <td key={ws.id} className="px-4 py-3">
                      {m ? (
                        <div className="flex flex-wrap gap-1">
                          {m.roles.map((r) => <RoleBadge key={r} roleKey={r} size="sm" />)}
                        </div>
                      ) : (
                        <span className="text-2xs text-muted-foreground/60">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
