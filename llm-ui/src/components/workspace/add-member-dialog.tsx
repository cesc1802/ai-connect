import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/widgets/avatar";
import { RoleBadge } from "@/components/widgets/role-badge";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { apiMemberToUser } from "@/lib/api-member-adapter";
import { addMember, listMemberCandidates, type MemberCandidate } from "@/lib/workspace-members-api";
import type { WsRoleKey } from "@/lib/mock-data";
import { WsRoleChecklist } from "./ws-role-checklist";

// Design extension: the prototype's "Thêm thành viên" button is inert; this
// dialog reuses the AddTemplatesDialog visual vocabulary to pick an org user
// not yet in the workspace and assign initial roles.

type Props = {
  workspaceId: string;
  onClose: () => void;
  onAdded: () => void;
};

export function AddMemberDialog({ workspaceId, onClose, onAdded }: Props) {
  const [candidates, setCandidates] = useState<MemberCandidate[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [roles, setRoles] = useState<WsRoleKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listMemberCandidates(workspaceId)
      .then((list) => { if (!cancelled) setCandidates(list); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [workspaceId]);

  const pool = (candidates ?? []).filter((c) =>
    c.username.toLowerCase().includes(query.toLowerCase()),
  );
  const toggleRole = (r: WsRoleKey) =>
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  const add = async () => {
    if (!selected || roles.length === 0) return;
    setSaving(true);
    setSaveError(false);
    try {
      await addMember(workspaceId, selected, roles);
      onAdded();
    } catch {
      setSaveError(true);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border bg-card shadow-md">
        <div className="flex items-center gap-3 border-b p-4">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name="user-plus" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Thêm thành viên</div>
            <div className="text-xs text-muted-foreground">Chọn người dùng trong tổ chức và gán vai trò.</div>
          </div>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-accent">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b p-4">
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm người dùng…" className="pl-9" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loadError ? (
            <div className="py-10 text-center text-sm text-destructive">Không tải được danh sách người dùng.</div>
          ) : candidates === null ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Đang tải…</div>
          ) : pool.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Không còn người dùng nào để thêm.</div>
          ) : (
            pool.map((c) => (
              <button
                key={c.userId}
                type="button"
                onClick={() => setSelected(c.userId)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border border-transparent p-2 text-left transition-colors",
                  selected === c.userId ? "border-primary/40 bg-primary/5" : "hover:bg-accent/40",
                )}
              >
                <Avatar user={apiMemberToUser(c)} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.username}</div>
                </div>
                <RoleBadge roleKey={c.orgRole} type="org" size="sm" />
              </button>
            ))
          )}
        </div>
        <div className="space-y-3 border-t p-4">
          <p className="text-xs font-medium text-muted-foreground">Vai trò trong workspace</p>
          <WsRoleChecklist roles={roles} onToggle={toggleRole} />
          {saveError && (
            <p className="text-xs text-destructive">Không thêm được thành viên. Vui lòng thử lại.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Hủy</Button>
            <Button onClick={() => void add()} disabled={!selected || roles.length === 0 || saving}>
              <Icon name="user-plus" className="h-4 w-4" />Thêm thành viên
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
