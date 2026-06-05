import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/widgets/avatar";
import { RoleBadge } from "@/components/widgets/role-badge";
import { WsEmblem } from "@/components/widgets/ws-emblem";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { USERS, WORKSPACES, ORG_ROLES, membershipsOf } from "@/lib/mock-data";

export function PermissionsScreen() {
  const [selectedId, setSelectedId] = useState<string>(USERS[0].id);
  const [query, setQuery] = useState("");

  const filtered = USERS.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const selected = USERS.find((u) => u.id === selectedId)!;
  const memberships = membershipsOf(selected.id);
  const joinedWsIds = new Set(memberships.map((m) => m.ws.id));
  const availableWs = WORKSPACES.filter((w) => !joinedWsIds.has(w.id));

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader title="Phân quyền" description="Gán thành viên vào workspaces và cấp vai trò chi tiết" />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3 rounded-xl border bg-card p-3">
          <div className="relative">
            <Icon name="search" className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm thành viên..." className="pl-8" />
          </div>
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {filtered.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => setSelectedId(u.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors",
                    selectedId === u.id ? "bg-primary/10" : "hover:bg-accent",
                  )}
                >
                  <Avatar user={u} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.name}</p>
                    <p className="truncate text-2xs text-muted-foreground">{ORG_ROLES[u.org].label}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-5 rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <Avatar user={selected} size={48} />
            <div className="flex-1">
              <p className="text-base font-semibold">{selected.name}</p>
              <p className="text-2xs text-muted-foreground">{selected.email}</p>
            </div>
            <RoleBadge roleKey={selected.org} type="org" />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspaces đã tham gia</h4>
              <Button variant="outline" size="sm" disabled={availableWs.length === 0}>
                <Icon name="plus" className="h-3.5 w-3.5" /> Gán workspace
              </Button>
            </div>
            <div className="space-y-2">
              {memberships.length === 0 && (
                <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Chưa được gán vào workspace nào.</p>
              )}
              {memberships.map((m) => (
                <div key={m.ws.id} className="flex items-center gap-3 rounded-lg border bg-background p-3">
                  <WsEmblem ws={m.ws} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.ws.name}</p>
                    <p className="truncate text-2xs text-muted-foreground">{m.ws.desc}</p>
                  </div>
                  <div className="flex gap-1">
                    {m.roles.map((r) => <RoleBadge key={r} roleKey={r} />)}
                  </div>
                  <Button variant="ghost" size="icon-sm"><Icon name="square-pen" className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>

          {availableWs.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspaces có thể gán</h4>
              <div className="space-y-2">
                {availableWs.map((ws) => (
                  <div key={ws.id} className="flex items-center gap-3 rounded-lg border border-dashed p-3">
                    <WsEmblem ws={ws} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{ws.name}</p>
                    </div>
                    <Button variant="outline" size="sm">Gán</Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
