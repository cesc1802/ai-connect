import { memo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/lib/icons";
import { useChatStore } from "@/lib/chat-context";
import type { MyWorkspace } from "@/lib/my-workspaces-api";
import { wsHue } from "@/lib/workspace-hue";
import { wsShortName } from "@/lib/workspace-display-name";
import type { PromptTemplate } from "@/lib/workspace-templates-api";
import type { ChatV2ClientState } from "@/lib/ws-client";

export interface ComposerProps {
  workspace: MyWorkspace;
  template: PromptTemplate | null;
  /** Templates attached to the active workspace, for the inline picker. */
  templates: PromptTemplate[];
  /** New conversations must be seeded from a template; legacy ones may not have one. */
  templateRequired: boolean;
  /** False when no default model is available — typed text is kept, send is disabled. */
  canSend: boolean;
  socketState: ChatV2ClientState;
  onSend: (text: string) => void;
  /** Absent once the conversation exists — its template is then fixed. */
  onPickTemplate?: (id: string) => void;
  onAbort: () => void;
}

// Composer — its prompt-template picker is scoped to the ACTIVE workspace.
// Holds `input` locally so parent re-renders (token streams) do not steal
// focus mid-typing.
export const Composer = memo(function Composer({
  workspace,
  template,
  templates,
  templateRequired,
  canSend,
  socketState,
  onSend,
  onPickTemplate,
  onAbort,
}: ComposerProps) {
  const { state } = useChatStore();
  const [val, setVal] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const socketOpen = socketState === "open";
  const busy = state.status !== "idle";
  const blocked = templateRequired && !template;
  const disabled = !val.trim() || busy || !socketOpen || blocked || !canSend;

  const send = () => {
    if (disabled) return;
    onSend(val.trim());
    setVal("");
    if (ref.current) ref.current.style.height = "auto";
  };
  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      <div className="rounded-xl border bg-background/95 shadow-sm backdrop-blur-sm focus-within:ring-1 focus-within:ring-ring">
        {/* prompt-template selector (current workspace only) */}
        <div className="relative flex items-center gap-2 px-2 pt-2">
          {onPickTemplate ? (
            <button type="button" onClick={() => setPickOpen((v) => !v)} className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-2xs font-medium transition-colors hover:bg-accent">
              <Icon name={template ? template.icon : "scroll-text"} className="h-3.5 w-3.5 text-primary" />
              <span className="max-w-[180px] truncate">{template ? template.title : "Chọn mẫu prompt"}</span>
              <Icon name="chevron-down" className={cn("h-3 w-3 text-muted-foreground transition-transform", pickOpen && "rotate-180")} />
            </button>
          ) : (
            template && (
              <span className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-2xs font-medium">
                <Icon name={template.icon} className="h-3.5 w-3.5 text-primary" />
                <span className="max-w-[180px] truncate">{template.title}</span>
              </span>
            )
          )}
          <span className="flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `oklch(0.62 0.15 ${wsHue(workspace.id)})` }} />
            <span className="truncate">{wsShortName(workspace.name)}</span>
          </span>
          {pickOpen && onPickTemplate && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setPickOpen(false)} />
              <div className="absolute bottom-full left-2 z-30 mb-1 max-h-64 w-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95">
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: `oklch(0.62 0.15 ${wsHue(workspace.id)})` }} />
                  <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Mẫu trong {wsShortName(workspace.name)}</span>
                </div>
                {templates.map((t) => (
                  <button key={t.id} type="button" onClick={() => { onPickTemplate?.(t.id); setPickOpen(false); }}
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent", template?.id === t.id && "bg-accent/60")}>
                    <Icon name={t.icon} className="h-4 w-4 shrink-0 text-primary" />
                    <span className="flex-1 truncate text-sm">{t.title}</span>
                    {template?.id === t.id && <Icon name="check" className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                ))}
                {templates.length === 0 && <div className="px-2 py-4 text-center text-2xs text-muted-foreground">Workspace này chưa có mẫu.</div>}
              </div>
            </>
          )}
        </div>
        {/* input row */}
        <div className="flex items-end">
          <button className="shrink-0 py-3 pl-3 pr-1 text-muted-foreground hover:text-foreground" disabled title="Đính kèm (sắp ra mắt)">
            <Icon name="paperclip" className="h-4 w-4" />
          </button>
          <textarea
            ref={ref}
            value={val}
            rows={1}
            onChange={(e) => { setVal(e.target.value); grow(); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={template ? `Nhập nội dung cho mẫu "${template.title}"…` : blocked ? "Chọn mẫu prompt để bắt đầu…" : "Nhập tin nhắn…"}
            className="flex-1 resize-none bg-transparent px-1 py-3 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="shrink-0 p-2">
            {busy ? (
              <button onClick={onAbort} title="Dừng" className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card text-foreground transition-colors hover:bg-accent">
                <Icon name="square" className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button onClick={send} disabled={disabled} className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30">
                <Icon name="send" className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-center text-2xs text-muted-foreground">
        {!socketOpen ? "Đang kết nối…" : "Mẫu prompt từ thư viện workspace · có thể dùng tool và truy cập Knowledge Vault."}
      </p>
    </div>
  );
});
