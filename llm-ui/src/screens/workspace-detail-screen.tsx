import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WsEmblem } from "@/components/widgets/ws-emblem";
import { RoleBadge } from "@/components/widgets/role-badge";
import { WorkspaceSettingsTab } from "@/components/widgets/workspace-settings-tab";
import { MembersTab } from "@/components/workspace/members-tab";
import { TemplatesTab } from "@/components/workspace/templates-tab";
import { ProvidersTab } from "@/components/workspace/providers-tab";
import { AddMemberDialog } from "@/components/workspace/add-member-dialog";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api-error";
import { hueFromString } from "@/lib/slugify";
import { getWorkspace, type WorkspaceSummary } from "@/lib/workspaces-api";
import { listMembers, type WorkspaceMember } from "@/lib/workspace-members-api";
import { WS_ROLES, type WsRoleKey } from "@/lib/mock-data";

type Tab = "members" | "templates" | "providers" | "settings";
const TABS: Array<[Tab, string]> = [
  ["members", "Thành viên"],
  ["templates", "Prompt Templates"],
  ["providers", "Providers"],
  ["settings", "Cấu hình"],
];

type LoadState =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "error" }
  | { kind: "ready"; ws: WorkspaceSummary };

export function WorkspaceDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [tab, setTab] = useState<Tab>("members");
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [membersError, setMembersError] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  // Monotonic sequences guard against stale responses when the route param
  // changes mid-flight: only the latest request may write state.
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    if (!id) {
      setState({ kind: "notfound" });
      return;
    }
    setState({ kind: "loading" });
    try {
      const ws = await getWorkspace(id);
      if (seq === loadSeq.current) setState({ kind: "ready", ws });
    } catch (err) {
      if (seq !== loadSeq.current) return;
      if (err instanceof ApiError && err.status === 404) setState({ kind: "notfound" });
      else setState({ kind: "error" });
    }
  }, [id]);

  const membersSeq = useRef(0);
  const loadMembers = useCallback(async () => {
    if (!id) return;
    const seq = ++membersSeq.current;
    setMembersError(false);
    try {
      const list = await listMembers(id);
      if (seq === membersSeq.current) setMembers(list);
    } catch {
      if (seq === membersSeq.current) setMembersError(true);
    }
  }, [id]);

  useEffect(() => {
    void load();
    setMembers(null);
    void loadMembers();
  }, [load, loadMembers]);

  if (state.kind === "loading") {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Đang tải workspace…</p>
      </div>
    );
  }

  if (state.kind === "notfound") {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Workspace không tồn tại.</p>
        <Link to="/workspaces" className="text-sm text-primary underline">Quay lại</Link>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm font-medium text-destructive">Không tải được workspace.</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>Thử lại</Button>
      </div>
    );
  }

  const ws = state.ws;
  const roleCounts = (Object.keys(WS_ROLES) as WsRoleKey[])
    .map((k) => ({ k, n: (members ?? []).filter((m) => m.wsRoles.includes(k)).length }))
    .filter((x) => x.n > 0);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <Link
          to="/workspaces"
          className="mb-3 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Icon name="chevron-left" className="h-3.5 w-3.5" />Workspaces
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <WsEmblem ws={{ hue: hueFromString(ws.slug) }} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{ws.name}</h1>
            <p className="text-sm text-muted-foreground">{ws.slug}</p>
          </div>
          <Button onClick={() => setAddingMember(true)}>
            <Icon name="user-plus" className="h-4 w-4" />Thêm thành viên
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">Phân bổ vai trò:</span>
        {roleCounts.map(({ k, n }) => (
          <span key={k} className="inline-flex items-center gap-1">
            <RoleBadge roleKey={k} type="ws" size="sm" />
            <span className="text-2xs text-muted-foreground">×{n}</span>
          </span>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {members === null ? "…" : `${members.length} thành viên`}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="inline-flex h-9 items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
          {TABS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                tab === k ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <Link to="/matrix" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <Icon name="grid-3x3" className="h-3.5 w-3.5" />Xem ma trận phân quyền
        </Link>
      </div>

      {tab === "members" && (
        <MembersTab
          workspaceId={ws.id}
          members={members}
          error={membersError}
          onRetry={() => void loadMembers()}
          onChanged={loadMembers}
        />
      )}
      {tab === "templates" && <TemplatesTab workspaceId={ws.id} />}
      {tab === "providers" && <ProvidersTab workspaceId={ws.id} />}
      {tab === "settings" && (
        <WorkspaceSettingsTab
          workspace={ws}
          onUpdated={(updated) => setState({ kind: "ready", ws: updated })}
          onDeleted={() => navigate("/workspaces")}
        />
      )}

      {addingMember && (
        <AddMemberDialog
          workspaceId={ws.id}
          onClose={() => setAddingMember(false)}
          onAdded={() => {
            setAddingMember(false);
            void loadMembers();
          }}
        />
      )}
    </div>
  );
}
