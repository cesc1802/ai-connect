import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons";
import { ApiError } from "@/lib/api-error";
import { deleteTemplate, type PromptTemplate } from "@/lib/workspace-templates-api";

type Props = {
  open: boolean;
  template: PromptTemplate | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
};

// Confirm-delete for a library template. Owns the API call; a template still
// attached to a workspace comes back 409 and is surfaced inline instead of
// silently cascading.
export function TemplateDeleteDialog({ open, template, onClose, onDeleted }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function confirm() {
    if (!template || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteTemplate(template.id);
      onDeleted(template.id);
    } catch (err) {
      if (err instanceof ApiError && err.code === "template_in_use") {
        setError("Template đang được gắn vào workspace — gỡ khỏi các workspace trước khi xoá.");
      } else if (err instanceof ApiError && err.status === 403) {
        setError("Chỉ admin tổ chức mới có thể xoá template.");
      } else {
        setError("Không thể xoá template. Thử lại sau.");
      }
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Xoá template"
      description="Hành động này không thể hoàn tác."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={submitting}>
            <Icon name="trash-2" className="h-4 w-4" /> Xoá
          </Button>
        </>
      }
    >
      <p className="text-sm">
        Bạn có chắc muốn xoá template{" "}
        <span className="font-semibold">{template?.title}</span>? Template sẽ biến mất
        khỏi thư viện của toàn tổ chức.
      </p>
      {error && (
        <p className="mt-2 flex items-center gap-1 text-2xs text-destructive">
          <Icon name="circle-alert" className="h-3 w-3" />{error}
        </p>
      )}
    </Dialog>
  );
}
