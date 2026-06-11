import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/widgets/avatar";
import { RoleBadge } from "@/components/widgets/role-badge";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import type { User } from "@/lib/mock-data";
import type { OrgRole } from "@/lib/workspace-types";
import { listUsers, type ApiUser } from "@/lib/users-api";

const ROLE_FILTERS: Array<{ key: "all" | OrgRole; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "admin", label: "Admin" },
  { key: "member", label: "Member" },
];

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; items: ApiUser[] };

// Deterministic id → hue so avatars keep a stable color without storing one.
function hashHue(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}

// Avatar only reads `name` and `hue`; the remaining mock User fields are unused.
function avatarUser(u: ApiUser): User {
  return { name: u.username, hue: hashHue(u.id) } as User;
}

export function MembersScreen() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | OrgRole>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Monotonic sequence guards against overlapping loads (retry clicks): only
  // the latest in-flight response may write state.
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setState({ kind: "loading" });
    try {
      const items = await listUsers();
      if (seq === loadSeq.current) setState({ kind: "ready", items });
    } catch {
      if (seq === loadSeq.current) setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items = state.kind === "ready" ? state.items : [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (u) =>
        (filter === "all" || u.role === filter) &&
        (!q || u.username.toLowerCase().includes(q)),
    );
  }, [items, query, filter]);

  const selected = items.find((u) => u.id === selectedId);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader
        title="Thành viên"
        description={
          state.kind === "ready" ? `${items.length} người dùng trong tổ chức` : "Danh sách người dùng"
        }
        actions={<Button><Icon name="user-plus" className="h-4 w-4" /> Mời</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Icon name="search" className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên đăng nhập..." className="pl-8" />
        </div>
        <div className="flex gap-1 rounded-md border bg-card p-1">
          {ROLE_FILTERS.map((f) => (
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

      {state.kind === "loading" && (
        <div className="rounded-xl border border-dashed bg-card/40 py-12 text-center text-sm text-muted-foreground">
          Đang tải danh sách thành viên…
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
          <p className="text-sm font-medium text-destructive">Không tải được danh sách thành viên.</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>Thử lại</Button>
        </div>
      )}

      {state.kind === "ready" && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-2xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Thành viên</th>
                <th className="px-4 py-2.5 text-left font-medium">Vai trò tổ chức</th>
                <th className="px-4 py-2.5 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar user={avatarUser(u)} size={36} />
                      <p className="truncate font-medium">{u.username}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RoleBadge roleKey={u.role} type="org" /></td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon-sm" onClick={() => setSelectedId(u.id)}>
                      <Icon name="chevron-right" className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr className="border-t">
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Không có thành viên phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setSelectedId(null)}>
          <div onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l bg-background p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Hồ sơ thành viên</h3>
              <Button variant="ghost" size="icon-sm" onClick={() => setSelectedId(null)}><Icon name="x" className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-col items-center gap-3 pb-5">
              <Avatar user={avatarUser(selected)} size={80} />
              <p className="text-base font-semibold">{selected.username}</p>
              <RoleBadge roleKey={selected.role} type="org" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
