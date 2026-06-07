import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons";
import { useChatStore } from "@/lib/chat-context";

export function StreamingControls({ onAbort }: { onAbort: () => void }) {
  const { state } = useChatStore();
  const visible = state.status === "sending" || state.status === "streaming";
  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-12 flex justify-center">
      <Button
        variant="destructive"
        size="sm"
        onClick={onAbort}
        className="pointer-events-auto shadow-lg"
      >
        <Icon name="x" className="h-3.5 w-3.5" /> Dừng
      </Button>
    </div>
  );
}
