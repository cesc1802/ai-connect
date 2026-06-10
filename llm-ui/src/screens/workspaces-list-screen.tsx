import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { WsEmblem } from "@/components/widgets/ws-emblem";
import { WorkspaceCreateDialog } from "@/components/widgets/workspace-create-dialog";
import { Icon } from "@/lib/icons";
import { hueFromString } from "@/lib/slugify";
import {
  listWorkspaces,
  type WorkspacePage,
  type WorkspaceSummary,
} from "@/lib/workspaces-api";

const WS_PAGE_SIZE = 6;

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; data: WorkspacePage };

export function WorkspacesListScreen() {
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [creating, setCreating] = useState(false);

  // Monotonic sequence guards against rapid page clicks: only the latest
  // in-flight response may write state, so a slow earlier page can't win.
  const loadSeq = useRef(0);
  const load = useCallback(async (p: number) => {
    const seq = ++loadSeq.current;
    setState({ kind: "loading" });
    try {
      const data = await listWorkspaces(p, WS_PAGE_SIZE);
      if (seq === loadSeq.current) setState({ kind: "ready", data });
    } catch {
      if (seq === loadSeq.current) setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [page, load]);

  // Deleting/racing past the end leaves an empty page; snap back to the last
  // real page (server total is authoritative).
  useEffect(() => {
    if (state.kind !== "ready") return;
    const totalPages = Math.max(1, Math.ceil(state.data.total / WS_PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [state, page]);

  const total = state.kind === "ready" ? state.data.total : 0;
  const totalPages = Math.max(1, Math.ceil(total / WS_PAGE_SIZE));
  const onLastPage = state.kind === "ready" && page >= totalPages;

  function handleCreated() {
    setCreating(false);
    // New workspace sorts last by createdAt — jump to the page holding it.
    const lastPage = Math.max(1, Math.ceil((total + 1) / WS_PAGE_SIZE));
    if (lastPage === page) void load(page);
    else setPage(lastPage);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Workspaces"
        description="Mỗi workspace là một dự án độc lập với thành viên và vai trò riêng."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Icon name="plus" className="h-4 w-4" />Tạo workspace
          </Button>
        }
      />

      {state.kind === "loading" && (
        <div className="rounded-xl border border-dashed bg-card/40 py-12 text-center text-sm text-muted-foreground">
          Đang tải workspaces…
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
          <p className="text-sm font-medium text-destructive">Không tải được danh sách workspace.</p>
          <Button variant="outline" size="sm" onClick={() => void load(page)}>Thử lại</Button>
        </div>
      )}

      {state.kind === "ready" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.data.items.map((ws) => (
            <WorkspaceCard key={ws.id} ws={ws} />
          ))}
          {onLastPage && (
            <button onClick={() => setCreating(true)} className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card/40 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
              <Icon name="plus" className="h-6 w-6" /><span className="text-sm font-medium">Tạo workspace mới</span>
            </button>
          )}
        </div>
      )}

      <Pagination page={page} pageSize={WS_PAGE_SIZE} total={total} onPage={setPage} />

      <WorkspaceCreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}

function WorkspaceCard({ ws }: { ws: WorkspaceSummary }) {
  return (
    <Link
      to={`/workspaces/${ws.id}`}
      className="flex cursor-pointer flex-col gap-4 rounded-xl border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <WsEmblem ws={{ hue: hueFromString(ws.slug) }} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{ws.name}</div>
          <div className="truncate font-mono text-2xs text-muted-foreground">{ws.slug}</div>
        </div>
        <Icon name="chevron-right" className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <p className="text-xs text-muted-foreground">
        Tạo ngày {new Date(ws.createdAt).toLocaleDateString("vi-VN")}
      </p>
    </Link>
  );
}
