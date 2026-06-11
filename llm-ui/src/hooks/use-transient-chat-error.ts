import { useEffect, useMemo, useState } from "react";
import type { Msg } from "@/lib/chat-types";

function findLastError(messages: Msg[]): Msg | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.status === "error") return m;
  }
  return undefined;
}

// 5-second transient banner: surfaces the most recent SERVER_FAILED, then
// auto-dismisses. Re-arms when a *new* error message appears.
export function useTransientChatError(messages: Msg[]): Msg | undefined {
  const msg = useMemo(() => findLastError(messages), [messages]);
  const [shown, setShown] = useState<Msg | undefined>(undefined);
  useEffect(() => {
    if (!msg) return;
    setShown(msg);
    const t = setTimeout(() => setShown(undefined), 5000);
    return () => clearTimeout(t);
  }, [msg?.localId, msg?.errorCode]);
  return shown;
}
