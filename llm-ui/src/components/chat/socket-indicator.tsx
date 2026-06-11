import type { ChatV2ClientState } from "@/lib/ws-client";

// Small connection-state pill for the conversation header. Hidden while the
// socket is healthy.
export function SocketIndicator({ state, hasToken }: { state: ChatV2ClientState; hasToken: boolean }) {
  if (!hasToken) {
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-2xs text-amber-700 dark:text-amber-400">
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
    <span className="rounded-full bg-muted px-2 py-0.5 text-2xs text-muted-foreground">
      {label}
    </span>
  );
}
