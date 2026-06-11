import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/lib/icons";
import { wsHue } from "@/lib/workspace-hue";
import { wsShortName } from "@/lib/workspace-display-name";
import type { MyWorkspace } from "@/lib/my-workspaces-api";
import { WsRoleChips } from "./ws-role-chips";

interface WorkspaceSwitcherProps {
  memberships: MyWorkspace[];
  activeWsId: string;
  /** Conversation count per workspace id, derived from the rail data. */
  counts: Record<string, number>;
  onSelect: (wsId: string) => void;
}

// Step 1 of the chat flow: the member picks WHICH workspace to work in.
// Lists only workspaces they belong to, with role chips + conversation counts.
export function WorkspaceSwitcher({ memberships, activeWsId, counts, onSelect }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const active = memberships.find((m) => m.id === activeWsId) ?? memberships[0];
  if (!active) return null;
  return (
    <div className="relative">
      <div className="mb-1 px-0.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace</div>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2.5 rounded-lg border bg-background px-2.5 py-2 text-left transition-colors hover:bg-accent">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: `oklch(0.62 0.15 ${wsHue(active.id)})` }}>{wsShortName(active.name)[0]}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight">{wsShortName(active.name)}</div>
          <div className="mt-0.5"><WsRoleChips roles={active.roles} /></div>
        </div>
        <Icon name="chevron-down" className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95">
            <div className="px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace của bạn ({memberships.length})</div>
            {memberships.map((m) => {
              const isActive = m.id === activeWsId;
              return (
                <button key={m.id} onClick={() => { onSelect(m.id); setOpen(false); }}
                  className={cn("flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-accent", isActive && "bg-accent/60")}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: `oklch(0.62 0.15 ${wsHue(m.id)})` }}>{wsShortName(m.name)[0]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium leading-tight">{wsShortName(m.name)}</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <WsRoleChips roles={m.roles} />
                      <span className="text-2xs text-muted-foreground">· {counts[m.id] || 0} trò chuyện</span>
                    </div>
                  </div>
                  {isActive && <Icon name="check" className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
