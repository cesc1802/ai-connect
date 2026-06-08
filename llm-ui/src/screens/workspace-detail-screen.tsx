import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { WsEmblem } from "@/components/widgets/ws-emblem";
import { Avatar } from "@/components/widgets/avatar";
import { RoleBadge } from "@/components/widgets/role-badge";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { WORKSPACES, PROVIDERS, TEMPLATES, userById } from "@/lib/mock-data";

type Tab = "members" | "templates" | "providers" | "settings";
const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: "members", label: "Thành viên", icon: "users" },
  { key: "templates", label: "Prompt Templates", icon: "scroll-text" },
  { key: "providers", label: "Providers", icon: "cpu" },
  { key: "settings", label: "Cài đặt", icon: "settings" },
];

export function WorkspaceDetailScreen() {
  const { id } = useParams();
  const ws = WORKSPACES.find((w) => w.id === id);
  const [tab, setTab] = useState<Tab>("members");

  if (!ws) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Workspace không tồn tại.</p>
        <Link to="/workspaces" className="text-sm text-primary underline">Quay lại</Link>
      </div>
    );
  }

  const templates = TEMPLATES.filter((t) => ws.templates.includes(t.id));

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <Link to="/workspaces" className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground">
        <Icon name="chevron-left" className="h-3 w-3" /> Workspaces
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <WsEmblem ws={ws} size={56} />
        <div className="flex-1">
          <PageHeader title={ws.name} description={ws.desc} />
        </div>
        <Button variant="outline" size="sm"><Icon name="settings" className="h-4 w-4" /> Sửa</Button>
      </div>

      <div className="flex gap-1 rounded-md border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon name={t.icon} className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "members" && (
        <div className="space-y-2">
          {ws.members.map((m) => {
            const u = userById(m.uid);
            if (!u) return null;
            return (
              <div key={m.uid} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <Avatar user={u} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.name}</p>
                  <p className="truncate text-2xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex gap-1">
                  {m.roles.map((r) => <RoleBadge key={r} roleKey={r} />)}
                </div>
                <Button variant="ghost" size="icon-sm"><Icon name="user-cog" className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </div>
      )}

      {tab === "templates" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon name={t.icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-2xs">{t.cat}</span>
                    <span className="rounded-full border px-2 py-0.5 text-2xs text-muted-foreground">@{t.author}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "providers" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border bg-card p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon name={p.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="text-2xs text-muted-foreground">{p.model}</p>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
          ))}
        </div>
      )}

      {tab === "settings" && (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Cấu hình workspace (tên, mô tả, mã định danh, default provider, retention) sẽ hiển thị tại đây.
        </div>
      )}
    </div>
  );
}
