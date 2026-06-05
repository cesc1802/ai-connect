import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons";

type Props = {
  collapsed: boolean;
  onToggleSidebar: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

export function Topbar({ collapsed, onToggleSidebar, theme, onToggleTheme }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <Button variant="ghost" size="icon-sm" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        <Icon name={collapsed ? "panel-left-open" : "panel-left-close"} className="h-4 w-4" />
      </Button>

      <div className="relative hidden flex-1 max-w-md md:block">
        <Icon name="search" className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Tìm kiếm..."
          className="h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-2xs font-medium text-emerald-700 dark:text-emerald-400 sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Hoạt động
        </span>
        <Button variant="ghost" size="icon-sm" onClick={onToggleTheme} aria-label="Toggle theme">
          <Icon name={theme === "dark" ? "sun" : "moon"} className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Help">
          <Icon name="info" className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
