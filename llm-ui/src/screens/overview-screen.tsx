import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/widgets/stat-tile";
import { Avatar } from "@/components/widgets/avatar";
import { RoleBadge } from "@/components/widgets/role-badge";
import { WsEmblem } from "@/components/widgets/ws-emblem";
import { UsageSummary } from "@/components/widgets/usage-summary";
import { Icon } from "@/lib/icons";
import { getUsage, type UsageResponse } from "@/lib/usage-api";
import { USERS, WORKSPACES, PROVIDERS, ORG_ROLES, type OrgRoleKey } from "@/lib/mock-data";

export function OverviewScreen() {
  const orgRoleKeys: OrgRoleKey[] = ["owner", "admin", "member"];

  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  useEffect(() => {
    let active = true;
    getUsage()
      .then((data) => active && setUsage(data))
      .catch(() => active && setUsage(null))
      .finally(() => active && setUsageLoading(false));
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Tổng quan tổ chức"
        description="Growing • 9 thành viên • 2 workspaces hoạt động"
        actions={<Button><Icon name="user-plus" className="h-4 w-4" /> Mời thành viên</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon="users" label="Thành viên" value={String(USERS.length)} sub="+2 trong tháng" />
        <StatTile icon="layers" label="Workspaces" value={String(WORKSPACES.length)} sub="Đang hoạt động" />
        <StatTile icon="cpu" label="Providers" value={String(PROVIDERS.length)} sub="Đã cấu hình" />
        <StatTile icon="scroll-text" label="Prompt templates" value="12" sub="Sẵn dùng" />
      </div>

      <UsageSummary data={usage} loading={usageLoading} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Vai trò tổ chức</h3>
            <Link to="/members" className="text-2xs text-primary hover:underline">Xem tất cả</Link>
          </div>
          <div className="space-y-3">
            {orgRoleKeys.map((rk) => {
              const members = USERS.filter((u) => u.org === rk);
              const def = ORG_ROLES[rk];
              return (
                <div key={rk} className="flex items-center gap-3 rounded-lg border bg-background p-3">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${def.tint}`}>
                    <Icon name={def.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{def.label}</span>
                      <RoleBadge roleKey={rk} type="org" size="sm" />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{def.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {members.slice(0, 4).map((u) => <Avatar key={u.id} user={u} size={26} ring />)}
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{members.length}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Providers</h3>
            <Link to="/providers" className="text-2xs text-primary hover:underline">Quản lý</Link>
          </div>
          <div className="space-y-2.5">
            {PROVIDERS.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border bg-background p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon name={p.icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="truncate text-2xs text-muted-foreground">{p.model} • {p.status === "connected" ? "Đã kết nối" : "Cục bộ"}</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Workspaces</h3>
          <Link to="/workspaces" className="text-2xs text-primary hover:underline">Tất cả</Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {WORKSPACES.map((ws) => (
            <Link key={ws.id} to={`/workspaces/${ws.id}`} className="flex items-center gap-3 rounded-lg border bg-background p-4 transition-colors hover:border-primary/50 hover:bg-accent">
              <WsEmblem ws={ws} size={42} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{ws.name}</p>
                <p className="truncate text-2xs text-muted-foreground">{ws.members.length} thành viên • {ws.templates.length} templates • {ws.agents} agents</p>
              </div>
              <Icon name="chevron-right" className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
