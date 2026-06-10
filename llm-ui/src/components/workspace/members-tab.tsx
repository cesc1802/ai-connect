import { useState } from "react";
import { Button } from "@/components/ui/button";
import { replaceMemberRoles, type WorkspaceMember } from "@/lib/workspace-members-api";
import type { WsRoleKey } from "@/lib/mock-data";
import { WsMemberRow } from "./ws-member-row";
import { RoleEditPopover } from "./role-edit-popover";

// Members roster table. The screen owns the members list (the role chip bar
// needs the counts); this tab renders it and runs the role-edit flow.

type Props = {
  workspaceId: string;
  members: WorkspaceMember[] | null;
  error: boolean;
  onRetry: () => void;
  onChanged: () => Promise<void> | void;
};

export function MembersTab({ workspaceId, members, error, onRetry, onChanged }: Props) {
  const [editing, setEditing] = useState<WorkspaceMember | null>(null);

  if (error) {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-6">
        <p className="text-sm font-medium text-destructive">Không tải được danh sách thành viên.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>Thử lại</Button>
      </div>
    );
  }

  if (members === null) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Đang tải thành viên…</div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        Chưa có thành viên nào trong workspace này.
      </div>
    );
  }

  const saveRoles = async (roles: WsRoleKey[]) => {
    if (!editing) return;
    await replaceMemberRoles(workspaceId, editing.userId, roles);
    await onChanged();
    setEditing(null);
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Thành viên</th>
              <th className="px-4 py-2.5 text-left font-medium">Vai trò workspace</th>
              <th className="px-4 py-2.5 text-left font-medium">Vai trò org</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <WsMemberRow key={m.userId} member={m} onEdit={setEditing} />
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <RoleEditPopover member={editing} onClose={() => setEditing(null)} onSave={saveRoles} />
      )}
    </>
  );
}
