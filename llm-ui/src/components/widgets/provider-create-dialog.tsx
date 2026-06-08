import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons";
import {
  ProviderForm,
  type ProviderFormValues,
} from "@/components/widgets/provider-form";
import {
  PROVIDER_CATALOG,
  addProvider,
  catalogByKey,
  type Provider,
} from "@/lib/mock-data";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (p: Provider) => void;
};

export function ProviderCreateDialog({ open, onClose, onCreated }: Props) {
  function handleSubmit(values: ProviderFormValues) {
    const catalog = catalogByKey(values.providerKey) ?? PROVIDER_CATALOG[0];
    const isLocal = catalog.type === "local";
    const next: Provider = {
      id: `p_${catalog.key}_${Date.now().toString(36)}`,
      providerKey: catalog.key,
      name: catalog.name,
      icon: catalog.icon,
      status: isLocal ? "local" : "connected",
      keyLabel: values.keyLabel,
      masked: isLocal ? values.host : maskKey(values.key),
      host: values.host,
      model: values.model,
      usage: 0,
      scope: values.scope,
    };
    addProvider(next);
    onCreated?.(next);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Thêm provider"
      description="Kết nối một nhà cung cấp LLM cho tổ chức. Khoá được mã hoá AES-256-GCM."
      className="max-w-lg"
    >
      <ProviderForm
        mode="create"
        onSubmit={handleSubmit}
        footer={({ canSubmit }) => (
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Huỷ</Button>
            <Button type="submit" disabled={!canSubmit}>
              <Icon name="plus" className="h-4 w-4" /> Thêm provider
            </Button>
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
