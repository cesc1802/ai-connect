import { cn } from "@/lib/cn";
import { WS_ROLES, type WsRoleKey } from "@/lib/workspace-roles";

// Small workspace-role chips, reused in switcher rows.
export function WsRoleChips({ roles }: { roles: WsRoleKey[] }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {roles.map((r) => {
        const role = WS_ROLES[r];
        if (!role) return null;
        return (
          <span
            key={r}
            className={cn(
              "whitespace-nowrap rounded border px-1 py-px text-2xs font-medium leading-none",
              role.tint,
            )}
          >
            {role.short}
          </span>
        );
      })}
    </span>
  );
}
