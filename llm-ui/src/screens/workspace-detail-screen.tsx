import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { WsEmblem } from "@/components/widgets/ws-emblem";
import { WorkspaceSettingsTab } from "@/components/widgets/workspace-settings-tab";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api-error";
import { hueFromString } from "@/lib/slugify";
import { getWorkspace, type WorkspaceSummary } from "@/lib/workspaces-api";

type Tab = "members" | "templates" | "providers" | "settings";
const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: "members", label: "Thành viên", icon: "users" },
  { key: "templates", label: "Prompt Templates", icon: "scroll-text" },
  { key: "providers", label: "Providers", icon: "cpu" },
  { key: "settings", label: "Cấu hình", icon: "settings" },
];

// Tabs without a backend API yet render as muted placeholders.
const PLACEHOLDERS: Record<Exclude<Tab, "settings">, string> = {
  members: "Danh sách thành viên và vai trò workspace sẽ hiển thị tại đây.",
  templates: "Prompt templates gắn với workspace sẽ hiển thị tại đây.",
  providers: "Providers kế thừa từ tổ chức sẽ hiển thị tại đây.",
};

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

  // Monotonic sequence guards against stale responses when the route param
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

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <Link to="/workspaces" className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground">
        <Icon name="chevron-left" className="h-3 w-3" /> Workspaces
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <WsEmblem ws={{ hue: hueFromString(ws.slug) }} size={56} />
        <div className="flex-1">
          <PageHeader title={ws.name} description={ws.slug} />
        </div>
      </div>

      <div className="flex gap-1 rounded-md border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon name={t.icon} className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab !== "settings" && (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          {PLACEHOLDERS[tab]}
        </div>
      )}

      {tab === "settings" && (
        <WorkspaceSettingsTab
          workspace={ws}
          onUpdated={(updated) => setState({ kind: "ready", ws: updated })}
          onDeleted={() => navigate("/workspaces")}
        />
      )}
    </div>
  );
}
