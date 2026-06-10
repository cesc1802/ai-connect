import { cn } from "@/lib/cn";
import { Icon } from "@/lib/icons";
import { WS_ROLES, type WsRoleKey } from "@/lib/mock-data";

// Multi-select workspace-role checkrows, shared by RoleEditPopover and
// AddMemberDialog. Parents own the selected set.

type Props = {
  roles: WsRoleKey[];
  onToggle: (role: WsRoleKey) => void;
  className?: string;
};

export function WsRoleChecklist({ roles, onToggle, className }: Props) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {Object.values(WS_ROLES).map((def) => {
        const key = def.key as WsRoleKey;
        const on = roles.includes(key);
        return (
          <button
            key={def.key}
            type="button"
            onClick={() => onToggle(key)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
              on ? "border-primary/40 bg-primary/5" : "hover:bg-accent/40",
            )}
          >
            <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border", def.tint)}>
              <Icon name={def.icon} className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{def.label}</div>
            </div>
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-md border",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border",
              )}
            >
              {on && <Icon name="check" className="h-3 w-3" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
