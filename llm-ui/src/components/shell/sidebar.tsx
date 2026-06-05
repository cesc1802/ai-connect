import { NavLink } from "react-router-dom";
import { GrowingMark } from "@/components/brand/growing-mark";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { ORG_NAV } from "@/lib/nav";

type Props = {
  collapsed: boolean;
};

export function Sidebar({ collapsed }: Props) {
  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r bg-card transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[240px]",
      )}
    >
      <div className={cn("flex h-14 items-center gap-2 border-b px-3", collapsed && "justify-center px-0")}>
        <GrowingMark size={28} />
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Growing</span>
            <span className="text-2xs text-muted-foreground">AI Connect</span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {ORG_NAV.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <div className="px-4 pb-1.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
            )}
            <ul className="flex flex-col gap-0.5 px-2">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-foreground/80 hover:bg-accent hover:text-foreground",
                        collapsed && "justify-center px-0",
                      )
                    }
                    title={item.label}
                  >
                    <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("border-t p-3", collapsed && "flex justify-center")}>
        <div className={cn("flex items-center gap-2 rounded-md p-1.5", !collapsed && "bg-muted/40")}>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
            style={{ background: "oklch(0.88 0.07 38)", color: "oklch(0.4 0.13 38)" }}
          >
            TN
          </span>
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium">Thược Nguyễn</span>
              <span className="truncate text-2xs text-muted-foreground">Org Admin</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
