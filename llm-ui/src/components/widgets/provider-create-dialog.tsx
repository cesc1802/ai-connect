import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons";
import {
  ProviderForm,
  type ProviderFormValues,
} from "@/components/widgets/provider-form";
import type { Provider } from "@/lib/mock-data";
import { createProvider } from "@/lib/providers-api";
import { uiFormToCreateBody, wireToUiProvider } from "@/lib/provider-mapping";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (p: Provider) => void;
};

export function ProviderCreateDialog({ open, onClose, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: ProviderFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const wire = await createProvider(uiFormToCreateBody(values));
      onCreated?.(wireToUiProvider(wire));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo provider");
    } finally {
      setSubmitting(false);
    }
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
          <div className="space-y-3 border-t pt-4">
            {error && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <Icon name="info" className="h-3.5 w-3.5 shrink-0" /> {error}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Huỷ</Button>
              <Button type="submit" disabled={!canSubmit || submitting}>
                <Icon name="plus" className="h-4 w-4" />
                {submitting ? "Đang thêm…" : "Thêm provider"}
              </Button>
            </div>
          </div>
        )}
      />
    </Dialog>
  );
}
