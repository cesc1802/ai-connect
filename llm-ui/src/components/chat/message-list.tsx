import { useEffect, useRef } from "react";
import { useChatStore } from "@/lib/chat-context";
import { MessageBubble } from "./message-bubble";

export function MessageList() {
  const { state } = useChatStore();
  const endRef = useRef<HTMLDivElement | null>(null);

  // Pin to bottom as new tokens land. Cheap because endRef target is empty.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [state.messages]);

  if (state.messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Bắt đầu cuộc trò chuyện. Chọn một template ở bên trái hoặc nhập bên dưới.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-6">
      {state.messages.map((m) => (
        <MessageBubble key={`${m.localId}-${m.role}`} msg={m} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
