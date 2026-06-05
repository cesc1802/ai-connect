import { useState, useMemo } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/widgets/avatar";
import { RoleBadge } from "@/components/widgets/role-badge";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { USERS, ORG_ROLES, membershipsOf, type OrgRoleKey } from "@/lib/mock-data";

const ORG_FILTERS: Array<{ key: "all" | OrgRoleKey; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "owner", label: "Owner" },
  { key: "admin", label: "Admin" },
  { key: "member", label: "Member" },
];

export function MembersScreen() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | OrgRoleKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return USERS.filter((u) => {
      if (filter !== "all" && u.org !== filter) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [query, filter]);

  const selected = USERS.find((u) => u.id === selectedId);
  const memberships = selected ? membershipsOf(selected.id) : [];

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader
        title="Thành viên"
        description={`${USERS.length} người dùng trong tổ chức`}
        actions={<Button><Icon name="user-plus" className="h-4 w-4" /> Mời</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Icon name="search" className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên, email..." className="pl-8" />
        </div>
        <div className="flex gap-1 rounded-md border bg-card p-1">
          {ORG_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                filter === f.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-2xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Thành viên</th>
              <th className="px-4 py-2.5 text-left font-medium">Vai trò tổ chức</th>
              <th className="px-4 py-2.5 text-left font-medium">Workspaces</th>
              <th className="px-4 py-2.5 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const mship = membershipsOf(u.id);
              return (
                <tr key={u.id} className="border-t transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar user={u} size={36} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{u.name}</p>
                        <p className="truncate text-2xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RoleBadge roleKey={u.org} type="org" /></td>
                  <td className="px-4 py-3">
                    {mship.length === 0 ? (
                      <span className="text-2xs text-muted-foreground">Chưa tham gia</span>
                    ) : (
                      <div className="space-y-1">
                        {mship.map((m) => (
                          <div key={m.ws.id} className="flex items-center gap-2">
                            <span className="text-xs font-medium">{m.ws.name}</span>
                            <div className="flex gap-1">
                              {m.roles.map((r) => <RoleBadge key={r} roleKey={r} size="sm" />)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon-sm" onClick={() => setSelectedId(u.id)}>
                      <Icon name="chevron-right" className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setSelectedId(null)}>
          <div onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l bg-background p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Hồ sơ thành viên</h3>
              <Button variant="ghost" size="icon-sm" onClick={() => setSelectedId(null)}><Icon name="x" className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-col items-center gap-3 pb-5">
              <Avatar user={selected} size={80} />
              <div className="text-center">
                <p className="text-base font-semibold">{selected.name}</p>
                <p className="text-2xs text-muted-foreground">{selected.email}</p>
              </div>
              <RoleBadge roleKey={selected.org} type="org" />
              <p className="text-2xs text-muted-foreground">{ORG_ROLES[selected.org].desc}</p>
            </div>
            <div className="space-y-3 border-t pt-4">
              <h4 className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">Workspaces & vai trò</h4>
              {memberships.length === 0 && <p className="text-xs text-muted-foreground">Chưa tham gia workspace nào.</p>}
              {memberships.map((m) => (
                <div key={m.ws.id} className="rounded-lg border bg-card p-3">
                  <p className="text-sm font-semibold">{m.ws.name}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.roles.map((r) => <RoleBadge key={r} roleKey={r} size="sm" />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
