import { Icon } from "@/lib/icons";
import { Avatar } from "@/components/widgets/avatar";
import { RoleBadge, RoleList } from "@/components/widgets/role-badge";
import { apiMemberToUser } from "@/lib/api-member-adapter";
import type { WorkspaceMember } from "@/lib/workspace-members-api";

type Props = {
  member: WorkspaceMember;
  onEdit: (member: WorkspaceMember) => void;
};

export function WsMemberRow({ member, onEdit }: Props) {
  const u = apiMemberToUser(member);
  return (
    <tr className="border-t hover:bg-accent/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar user={u} size={34} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{u.name}</div>
            <div className="truncate text-xs text-muted-foreground">{u.email}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <RoleList roles={member.wsRoles} type="ws" />
      </td>
      <td className="px-4 py-3">
        <RoleBadge roleKey={member.orgRole} type="org" />
      </td>
      <td className="px-2 py-3 text-right">
        <button
          onClick={() => onEdit(member)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Icon name="square-pen" className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
