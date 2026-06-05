import { cn } from "@/lib/cn";
import { Icon } from "@/lib/icons";
import { ORG_ROLES, WS_ROLES } from "@/lib/mock-data";

type Props = {
  roleKey: string;
  type?: "org" | "ws";
  withIcon?: boolean;
  size?: "default" | "sm";
};

export function RoleBadge({ roleKey, type = "ws", withIcon = true, size = "default" }: Props) {
  const map = type === "org" ? ORG_ROLES : WS_ROLES;
  const def = (map as Record<string, { icon: string; short: string; tint: string }>)[roleKey];
  if (!def) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-2xs" : "px-2 py-0.5 text-xs",
        def.tint,
      )}
    >
      {withIcon && <Icon name={def.icon} className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />}
      {def.short}
    </span>
  );
}

export function RoleList({ roles, type = "ws", size = "default" }: { roles: string[]; type?: "org" | "ws"; size?: "default" | "sm" }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {roles.map((r) => (
        <RoleBadge key={r} roleKey={r} type={type} size={size} />
      ))}
    </div>
  );
}
