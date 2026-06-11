import { useEffect, useRef } from "react";
import { Icon } from "@/lib/icons";
import { useChatStore } from "@/lib/chat-context";
import type { Msg } from "@/lib/chat-types";
import type { PromptTemplate } from "@/lib/workspace-templates-api";
import { MessageBubble } from "./message-bubble";
import { TemplateInfoCard } from "./template-info-card";

// An assistant draft that has produced no token yet renders as typing dots
// instead of an empty bubble.
function isSilentDraft(m: Msg): boolean {
  return (
    m.role === "assistant" &&
    m.text === "" &&
    m.toolCalls.length === 0 &&
    (m.status === "pending" || m.status === "streaming")
  );
}

export function MessageList({ template }: { template?: PromptTemplate }) {
  const { state } = useChatStore();
  const endRef = useRef<HTMLDivElement | null>(null);

  // Pin to bottom as new tokens land. Cheap because endRef target is empty.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [state.messages]);

  const visible = state.messages.filter((m) => !isSilentDraft(m));
  const thinking = state.messages.some(isSilentDraft);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        {template && visible.length <= 1 && <TemplateInfoCard template={template} />}
        {visible.map((m) => (
          <MessageBubble key={`${m.localId}-${m.role}`} msg={m} templateIcon={template?.icon} />
        ))}
        {thinking && (
          <div className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon name={template?.icon ?? "message-square"} className="h-4 w-4" />
            </span>
            <div className="flex items-center gap-1.5 rounded-lg border bg-card px-4 py-3 shadow-sm">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
