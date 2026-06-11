import { memo, useState } from "react";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import type { Msg, ToolCall } from "@/lib/chat-types";

interface MessageBubbleProps {
  msg: Msg;
  /** Icon of the conversation's seeding template, used as assistant emblem. */
  templateIcon?: string;
}

export const MessageBubble = memo(function MessageBubble({ msg, templateIcon }: MessageBubbleProps) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {isUser ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon name="user" className="h-4 w-4" />
        </span>
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon name={templateIcon ?? "message-square"} className="h-4 w-4" />
        </span>
      )}
      <div
        className={cn(
          "rounded-lg border bg-card px-4 py-2 text-sm leading-relaxed text-card-foreground shadow-sm",
          isUser ? "max-w-[85%] border-r-2 border-r-accent-foreground" : "min-w-0 flex-1",
        )}
      >
        {msg.toolCalls.length > 0 && (
          <div className="mb-2 space-y-2">
            {msg.toolCalls.map((tc) => (
              <ChatToolCard key={tc.id} tc={tc} />
            ))}
          </div>
        )}
        <div className="whitespace-pre-wrap">{msg.text}</div>
        <StatusNote msg={msg} />
      </div>
    </div>
  );
});

function StatusNote({ msg }: { msg: Msg }) {
  if (msg.role !== "assistant") return null;
  if (msg.status === "aborted") {
    return <div className="mt-1 text-2xs text-muted-foreground">Đã dừng</div>;
  }
  if (msg.status === "error") {
    return <div className="mt-1 text-2xs text-destructive">Lỗi: {msg.errorCode ?? "unknown"}</div>;
  }
  return null;
}

function ChatToolCard({ tc }: { tc: ToolCall }) {
  const [open, setOpen] = useState(false);
  const color = tc.status === "error" ? "text-red-500" : "text-blue-500";
  const label = tc.status === "running" ? "Đang chạy…" : tc.status === "error" ? "Lỗi" : "Xong";
  return (
    <div className="rounded-md border bg-muted">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs">
        <Icon name="wrench" className={cn("h-3.5 w-3.5", color)} />
        <span className="shrink-0 font-mono font-medium">{tc.name}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <span className={cn("text-2xs", color)}>{label}</span>
          <Icon name="chevron-right" className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-90")} />
        </span>
      </button>
      {open && (
        <div className="border-t px-2 py-1.5">
          <div className="mb-1 text-2xs font-semibold uppercase text-muted-foreground">Tham số</div>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-background p-1.5 font-mono text-2xs">{tc.argsBuffer || "…"}</pre>
        </div>
      )}
    </div>
  );
}
