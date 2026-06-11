import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons";
import { wsHue } from "@/lib/workspace-hue";
import { wsShortName } from "@/lib/workspace-display-name";
import type { MyWorkspace } from "@/lib/my-workspaces-api";

// Main-pane empty state when the active workspace has no open conversation.
export function EmptyConversation({ workspace, onNew }: { workspace: MyWorkspace; onNew: () => void }) {
  const short = wsShortName(workspace.name);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-white" style={{ background: `oklch(0.62 0.15 ${wsHue(workspace.id)})` }}>{short[0]}</span>
      <div className="text-sm font-semibold">Chưa có trò chuyện trong {short}</div>
      <p className="max-w-xs text-xs text-muted-foreground">Bắt đầu bằng cách chọn một mẫu prompt từ workspace này.</p>
      <Button onClick={onNew}><Icon name="plus" className="h-4 w-4" />Trò chuyện mới</Button>
    </div>
  );
}
