import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons";
import { useChatStore } from "@/lib/chat-context";
import type { ChatV2ClientState } from "@/lib/ws-client";
import { TemplatePicker } from "./template-picker";

export interface ComposerProps {
  model: string;
  socketState: ChatV2ClientState;
  onSend: (text: string) => void;
  prefill?: string;
}

// Controlled textarea. Lifts `input` here so parent re-renders (token
// streams) do not steal focus mid-typing. `prefill` is consumed only when
// it changes (template click) — we mirror it into local state on change.
export const Composer = memo(function Composer({
  model,
  socketState,
  onSend,
  prefill,
}: ComposerProps) {
  const { state } = useChatStore();
  const [input, setInput] = useState("");
  const [lastPrefill, setLastPrefill] = useState<string | undefined>(undefined);

  if (prefill !== undefined && prefill !== lastPrefill) {
    setLastPrefill(prefill);
    setInput(prefill);
  }

  const socketOpen = socketState === "open";
  const busy = state.status !== "idle";
  const modelMissing = model.trim().length === 0;
  const disabled = busy || !socketOpen || modelMissing || !input.trim();

  function submit() {
    const text = input.trim();
    if (!text || disabled) return;
    onSend(text);
    setInput("");
  }

  return (
    <div className="border-t bg-background p-4">
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-2 shadow-sm">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Hỏi Growing bất cứ điều gì..."
          rows={2}
          className="resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center gap-2">
          <TemplatePicker onPick={setInput} />
          <Button variant="ghost" size="icon-sm" disabled title="Đính kèm (sắp ra mắt)">
            <Icon name="paperclip" className="h-4 w-4" />
          </Button>
          <div className="flex-1" />
          <Button size="sm" onClick={submit} disabled={disabled}>
            <Icon name="send" className="h-4 w-4" /> Gửi
          </Button>
        </div>
      </div>
      <p className="mt-1 text-center text-2xs text-muted-foreground">
        {!socketOpen
          ? "Đang kết nối…"
          : modelMissing
            ? "Chọn một model để bắt đầu."
            : "Growing có thể mắc lỗi — hãy kiểm chứng thông tin quan trọng."}
      </p>
    </div>
  );
});
