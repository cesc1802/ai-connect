import { IconTile } from "@/components/widgets/icon-tile";
import type { WorkspaceProvider } from "@/lib/workspace-providers-api";
import { ToggleSwitch } from "./toggle-switch";

type Props = {
  provider: WorkspaceProvider;
  busy: boolean;
  onToggle: (provider: WorkspaceProvider) => void;
};

export function WsProviderRow({ provider, busy, onToggle }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
      <IconTile icon={provider.icon} size={34} tone="muted" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{provider.name}</div>
        <div className="font-mono text-2xs text-muted-foreground">{provider.keyLabel} · org-level</div>
      </div>
      <ToggleSwitch
        checked={provider.enabled}
        disabled={busy}
        label={`Bật ${provider.name} cho workspace`}
        onChange={() => onToggle(provider)}
      />
    </div>
  );
}
