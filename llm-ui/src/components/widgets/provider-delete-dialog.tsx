import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons";
import type { Provider } from "@/lib/mock-data";

type Props = {
  open: boolean;
  provider: Provider | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function ProviderDeleteDialog({ open, provider, onClose, onConfirm }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Xoá provider"
      description="Hành động này không thể hoàn tác."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="destructive" onClick={onConfirm}>
            <Icon name="trash-2" className="h-4 w-4" /> Xoá
          </Button>
        </>
      }
    >
      <p className="text-sm">
        Bạn có chắc muốn xoá provider{" "}
        <span className="font-semibold">{provider?.name}</span>? Các phiên đang dùng
        provider này có thể bị gián đoạn.
      </p>
    </Dialog>
  );
}
