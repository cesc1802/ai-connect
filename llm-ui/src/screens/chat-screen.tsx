import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { TEMPLATES, TEMPLATE_CATEGORIES, PROVIDERS } from "@/lib/mock-data";
import { useChatStore } from "@/lib/chat-context";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { getDevToken, getWsUrl } from "@/lib/auth-token";
import { MessageList } from "@/components/chat/message-list";
import { Composer } from "@/components/chat/composer";
import { StreamingControls } from "@/components/chat/streaming-controls";

const ALL_MODELS = PROVIDERS.flatMap((p) => p.models);

export function ChatScreen() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("Tất cả");
  const [model, setModel] = useState(ALL_MODELS[0] ?? "");
  const [prefill, setPrefill] = useState<string | undefined>(undefined);

  const token = useMemo(() => getDevToken(), []);
  const wsUrl = useMemo(() => getWsUrl(), []);
  const { send, abort, socketState } = useChatSocket({ url: wsUrl, token });
  const { state } = useChatStore();

  const lastFailed = useMemo(() => findLastError(state.messages), [state.messages]);
  const errorBanner = useTransientError(lastFailed);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      if (cat !== "Tất cả" && t.cat !== cat) return false;
      if (!q) return true;
      return t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q);
    });
  }, [query, cat]);

  function handleSend(text: string) {
    if (!model.trim()) return;
    send({ text, model });
  }

  return (
    <div className="flex h-full">
      <aside className="hidden w-[280px] shrink-0 flex-col border-r bg-card lg:flex">
        <div className="border-b p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Templates
          </p>
          <div className="relative mt-2">
            <Icon name="search" className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm template..."
              className="h-8 w-full rounded-md border bg-background pl-7 pr-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1 border-b p-2">
          {TEMPLATE_CATEGORIES.slice(0, 6).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-2xs",
                cat === c && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <ul className="flex-1 space-y-1 overflow-y-auto p-2">
          {filtered.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => setPrefill(t.desc + "\n")}
                className="flex w-full items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-accent"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon name={t.icon} className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{t.title}</p>
                  <p className="line-clamp-2 text-2xs text-muted-foreground">{t.desc}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b bg-card/40 px-4 py-2.5">
          <Icon name="message-square" className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Trò chuyện</span>
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
            prefill={prefill}
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
