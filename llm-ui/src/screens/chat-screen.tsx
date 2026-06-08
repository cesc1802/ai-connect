import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/lib/icons";
import { PROVIDERS, CONVERSATIONS } from "@/lib/mock-data";
import { useChatStore } from "@/lib/chat-context";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { getDevToken, getWsUrl } from "@/lib/auth-token";
import { MessageList } from "@/components/chat/message-list";
import { Composer } from "@/components/chat/composer";
import { StreamingControls } from "@/components/chat/streaming-controls";
import { ChatHistoryList } from "@/components/chat/chat-history-list";

const ALL_MODELS = PROVIDERS.map((p) => p.model);

export function ChatScreen() {
  const [model, setModel] = useState(ALL_MODELS[0] ?? "");
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);

  const token = useMemo(() => getDevToken(), []);
  const wsUrl = useMemo(() => getWsUrl(), []);
  const { send, abort, socketState } = useChatSocket({ url: wsUrl, token });
  const { state } = useChatStore();

  const lastFailed = useMemo(() => findLastError(state.messages), [state.messages]);
  const errorBanner = useTransientError(lastFailed);

  const selectedConvo = useMemo(
    () => (selectedConvoId ? CONVERSATIONS.find((c) => c.id === selectedConvoId) : null),
    [selectedConvoId],
  );

  function handleSend(text: string) {
    if (!model.trim()) return;
    send({ text, model });
  }

  return (
    <div className="flex h-full">
      <ChatHistoryList selectedId={selectedConvoId} onSelect={setSelectedConvoId} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b bg-card/40 px-4 py-2.5">
          <Icon name="message-square" className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {selectedConvo ? selectedConvo.title : "Trò chuyện mới"}
            </p>
            {selectedConvo && (
              <p className="truncate text-2xs text-muted-foreground">
                {selectedConvo.msgCount} tin nhắn · cập nhật {selectedConvo.updatedLabel}
              </p>
            )}
          </div>
          <SocketIndicator state={socketState} hasToken={!!token} />
          <div className="ml-auto flex items-center gap-2">
            <Icon name="sliders-horizontal" className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-7 rounded-md border bg-background px-2 text-xs outline-none"
            >
              {ALL_MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {errorBanner && (
          <div className="border-b bg-destructive/10 px-4 py-2 text-xs text-destructive">
            Lỗi từ máy chủ ({errorBanner.errorCode}): {errorBanner.errorMessage}
          </div>
        )}

        <MessageList />

        <div className="relative">
          <StreamingControls onAbort={abort} />
          <Composer
            model={model}
            socketState={socketState}
            onSend={handleSend}
          />
        </div>
      </div>
    </div>
  );
}

function SocketIndicator({
  state,
  hasToken,
}: {
  state: ReturnType<typeof useChatSocket>["socketState"];
  hasToken: boolean;
}) {
  if (!hasToken) {
    return (
      <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-2xs text-amber-700 dark:text-amber-400">
        Thiếu dev token — đặt VITE_DEV_JWT
      </span>
    );
  }
  if (state === "open") return null;
  const label =
    state === "connecting"
      ? "Đang kết nối…"
      : state === "reconnecting"
        ? "Đang kết nối lại…"
        : state === "permanent-closed"
          ? "Mất kết nối"
          : "Chưa kết nối";
  return (
    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-2xs text-muted-foreground">
      {label}
    </span>
  );
}

function findLastError(messages: ReturnType<typeof useChatStore>["state"]["messages"]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.status === "error") return m;
  }
  return undefined;
}

// 5-second transient banner: surfaces the most recent SERVER_FAILED, then
// auto-dismisses. Re-arms when a *new* error message appears.
function useTransientError(
  msg:
    | ReturnType<typeof useChatStore>["state"]["messages"][number]
    | undefined,
) {
  const [shown, setShown] = useState<typeof msg>(undefined);
  useEffect(() => {
    if (!msg) return;
    setShown(msg);
    const t = setTimeout(() => setShown(undefined), 5000);
    return () => clearTimeout(t);
  }, [msg?.localId, msg?.errorCode]);
  return shown;
}
