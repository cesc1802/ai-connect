import { memo } from "react";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import type { Msg, ToolCall } from "@/lib/chat-types";

export const MessageBubble = memo(function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary/15 text-primary" : "bg-muted text-foreground",
        )}
      >
        <Icon name={isUser ? "user" : "bot"} className="h-3.5 w-3.5" />
      </span>
      <div
        className={cn(
          "max-w-2xl space-y-2 rounded-xl px-4 py-2.5 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "border bg-card",
        )}
      >
        <div className="whitespace-pre-wrap leading-relaxed">
          {msg.text}
          <StatusBadge msg={msg} />
        </div>
        {msg.toolCalls.map((tc) => (
          <ToolCallCard key={tc.id} tc={tc} />
        ))}
      </div>
    </div>
  );
});

function StatusBadge({ msg }: { msg: Msg }) {
  if (msg.role !== "assistant") return null;
  if (msg.status === "pending" || msg.status === "streaming") {
    return (
      <span className="ml-1 inline-block animate-pulse text-2xs text-muted-foreground">
        (running)
      </span>
    );
  }
  if (msg.status === "aborted") {
    return (
      <span className="ml-1 text-2xs text-muted-foreground">(stopped)</span>
    );
  }
  if (msg.status === "error") {
    return (
      <span className="ml-1 text-2xs text-destructive">
        (error: {msg.errorCode ?? "unknown"})
      </span>
    );
  }
  return null;
}

function ToolCallCard({ tc }: { tc: ToolCall }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 text-foreground">
      <div className="mb-1.5 flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
        <Icon name="wrench" className="h-3 w-3" /> Tool call · {tc.name}
        {tc.status === "running" && <span>· running…</span>}
      </div>
      <code className="block whitespace-pre-wrap font-mono text-2xs text-muted-foreground">
        args: {tc.argsBuffer || "…"}
      </code>
    </div>
  );
}
