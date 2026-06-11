import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons";
import {
  ProviderForm,
  type ProviderFormValues,
} from "@/components/widgets/provider-form";
import type { Provider } from "@/lib/mock-data";
import { rotateProviderKey, updateProvider } from "@/lib/providers-api";
import { uiFormToUpdateBody, wireToUiProvider } from "@/lib/provider-mapping";

type Props = {
  open: boolean;
  provider: Provider | null;
  onClose: () => void;
  onSaved?: (p: Provider) => void;
  onRequestDelete?: (p: Provider) => void;
};

export function ProviderEditDialog({ open, provider, onClose, onSaved, onRequestDelete }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!provider) return null;
  const current = provider;

  async function handleSubmit(values: ProviderFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      let wire = await updateProvider(current.id, uiFormToUpdateBody(values));
      const newKey = values.key.trim();
      if (newKey) wire = await rotateProviderKey(current.id, newKey);
      onSaved?.(wireToUiProvider(wire));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu thay đổi");
    } finally {
      setSubmitting(false);
    }
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
          <div className="space-y-3 border-t pt-4">
            {error && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <Icon name="info" className="h-3.5 w-3.5 shrink-0" /> {error}
              </p>
            )}
            <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => onRequestDelete?.(current)}
              >
                <Icon name="trash-2" className="h-4 w-4" /> Xoá provider
              </Button>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>Huỷ</Button>
                <Button type="submit" disabled={!canSubmit || submitting}>
                  <Icon name="check" className="h-4 w-4" />
                  {submitting ? "Đang lưu…" : "Lưu thay đổi"}
                </Button>
              </div>
            </div>
          </div>
        )}
      />
    </Dialog>
  );
}
