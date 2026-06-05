import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { WsEmblem } from "@/components/widgets/ws-emblem";
import { AvatarStack } from "@/components/widgets/avatar-stack";
import { Icon } from "@/lib/icons";
import { WORKSPACES, TEMPLATES } from "@/lib/mock-data";

export function WorkspacesListScreen() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader
        title="Workspaces"
        description={`${WORKSPACES.length} workspaces — không gian làm việc tách biệt theo nhóm`}
        actions={<Button><Icon name="plus" className="h-4 w-4" /> Tạo workspace</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {WORKSPACES.map((ws) => {
          const templates = TEMPLATES.filter((t) => ws.templates.includes(t.id));
          return (
            <Link
              key={ws.id}
              to={`/workspaces/${ws.id}`}
              className="group flex flex-col gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary/50"
            >
              <div className="flex items-start gap-3">
                <WsEmblem ws={ws} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">{ws.name}</p>
                  <p className="text-xs text-muted-foreground">{ws.desc}</p>
                </div>
                <Icon name="chevron-right" className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>

              <div className="grid grid-cols-3 gap-3 border-t pt-3">
                <div>
                  <p className="text-2xs uppercase tracking-wider text-muted-foreground">Thành viên</p>
                  <div className="mt-1 flex items-center gap-2">
                    <AvatarStack uids={ws.members.map((m) => m.uid)} max={4} size={22} />
                  </div>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-wider text-muted-foreground">Agents</p>
                  <p className="mt-1 text-sm font-semibold">{ws.agents}</p>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-wider text-muted-foreground">Templates</p>
                  <p className="mt-1 text-sm font-semibold">{templates.length}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
