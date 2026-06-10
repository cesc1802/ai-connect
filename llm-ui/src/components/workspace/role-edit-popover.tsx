import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/widgets/avatar";
import { apiMemberToUser } from "@/lib/api-member-adapter";
import type { WorkspaceMember } from "@/lib/workspace-members-api";
import type { WsRoleKey } from "@/lib/mock-data";
import { WsRoleChecklist } from "./ws-role-checklist";

// Modal role editor for one member. onSave persists; the parent closes the
// popover when the returned promise resolves.

type Props = {
  member: WorkspaceMember;
  onClose: () => void;
  onSave: (roles: WsRoleKey[]) => Promise<void>;
};

export function RoleEditPopover({ member, onClose, onSave }: Props) {
  const [roles, setRoles] = useState<WsRoleKey[]>(member.wsRoles);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const u = apiMemberToUser(member);

  const toggle = (r: WsRoleKey) =>
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  const save = async () => {
    setSaving(true);
    setError(false);
    try {
      await onSave(roles);
    } catch {
      setError(true);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-xl border bg-card p-5 shadow-md">
        <div className="flex items-center gap-3 border-b pb-3">
          <Avatar user={u} size={40} />
          <div>
            <div className="text-sm font-semibold">{u.name}</div>
            <div className="text-xs text-muted-foreground">Vai trò trong workspace</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Một thành viên có thể kiêm nhiều vai trò (vd. BA + QA).
        </p>
        <WsRoleChecklist roles={roles} onToggle={toggle} className="mt-3" />
        {error && (
          <p className="mt-3 text-xs text-destructive">Không lưu được vai trò. Vui lòng thử lại.</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button onClick={() => void save()} disabled={roles.length === 0 || saving}>
            Lưu vai trò
          </Button>
        </div>
      </div>
    </div>
  );
}
