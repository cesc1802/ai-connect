import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons";
import type { Provider } from "@/lib/mock-data";

type Props = {
  open: boolean;
  provider: Provider | null;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
  error?: string | null;
};

export function ProviderDeleteDialog({ open, provider, onClose, onConfirm, busy, error }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Xoá provider"
      description="Hành động này không thể hoàn tác."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            <Icon name="trash-2" className="h-4 w-4" /> {busy ? "Đang xoá…" : "Xoá"}
          </Button>
        </>
      }
    >
      <p className="text-sm">
        Bạn có chắc muốn xoá provider{" "}
        <span className="font-semibold">{provider?.name}</span>? Các phiên đang dùng
        provider này có thể bị gián đoạn.
      </p>
      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
          <Icon name="info" className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}
    </Dialog>
  );
}
