import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons";
import {
  ProviderForm,
  type ProviderFormValues,
} from "@/components/widgets/provider-form";
import { updateProvider, type Provider } from "@/lib/mock-data";

type Props = {
  open: boolean;
  provider: Provider | null;
  onClose: () => void;
  onRequestDelete?: (p: Provider) => void;
};

export function ProviderEditDialog({ open, provider, onClose, onRequestDelete }: Props) {
  if (!provider) return null;

  function handleSubmit(values: ProviderFormValues) {
    const rotated = values.key.trim().length > 0;
    updateProvider(provider!.id, {
      host: values.host,
      keyLabel: values.keyLabel,
      model: values.model,
      scope: values.scope,
      masked: provider!.status === "local"
        ? values.host
        : (rotated ? maskKey(values.key) : provider!.masked),
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Cấu hình · ${provider.name}`}
      description={`${provider.status === "local" ? "local" : "org-level"} · ${provider.keyLabel}`}
      className="max-w-lg"
    >
      <ProviderForm
        mode="edit"
        initial={provider}
        onSubmit={handleSubmit}
        footer={({ canSubmit }) => (
          <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => onRequestDelete?.(provider!)}
            >
              <Icon name="trash-2" className="h-4 w-4" /> Xoá provider
            </Button>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Huỷ</Button>
              <Button type="submit" disabled={!canSubmit}>
                <Icon name="check" className="h-4 w-4" /> Lưu thay đổi
              </Button>
            </div>
          </div>
        )}
      />
    </Dialog>
  );
}

function maskKey(raw: string): string {
  const tail = raw.slice(-4).padStart(4, "•");
  return `sk-${"•".repeat(11)} ${tail}`;
}
