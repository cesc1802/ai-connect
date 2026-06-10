import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { IconTile } from "@/components/widgets/icon-tile";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api-error";
import { TEMPLATE_CATEGORIES } from "@/lib/mock-data";
import {
  createTemplate,
  updateTemplate,
  type PromptTemplate,
} from "@/lib/workspace-templates-api";

// Curated icon set for a new template — all registered in lib/icons.
const TEMPLATE_ICONS = [
  "scroll-text", "code", "chart-line", "bug", "briefcase", "sparkles",
  "message-square", "mail", "git-branch", "circle-check", "hash", "grid-3x3",
];

type Props = {
  /** Pass to edit — fields prefill, header + primary action switch to edit copy. */
  template?: PromptTemplate | undefined;
  onClose: () => void;
  onSaved: (t: PromptTemplate) => void;
};

// Create OR edit a prompt template. Mirrors the Create workspace dialog
// system: header tile + title/subtitle + X, icon-prefixed field rows with 2xs
// captions, a live card preview, and a ghost-cancel / primary-action footer.
// Title + description are required; the prompt body is optional.
export function TemplateDialog({ template, onClose, onSaved }: Props) {
  const editing = !!template;
  const cats = TEMPLATE_CATEGORIES.slice(1); // drop "Tất cả"
  const [title, setTitle] = useState(template?.title ?? "");
  const [cat, setCat] = useState(template?.category ?? cats[0] ?? "");
  const [icon, setIcon] = useState(template?.icon ?? TEMPLATE_ICONS[0] ?? "");
  const [desc, setDesc] = useState(template?.description ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSave = !!title.trim() && !!desc.trim() && !submitting;

  async function submit() {
    if (!canSave) return;
    setSubmitting(true);
    setError(null);
    const input = {
      title: title.trim(),
      category: cat,
      icon,
      description: desc.trim(),
      body: body.trim(),
    };
    try {
      const saved = template
        ? await updateTemplate(template.id, input)
        : await createTemplate(input);
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("Chỉ admin tổ chức mới có thể thay đổi thư viện template.");
      } else {
        setError("Không thể lưu template. Thử lại sau.");
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border bg-card shadow-md">
        {/* header */}
        <div className="flex items-center gap-3 border-b p-4">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name={editing ? "square-pen" : "scroll-text"} className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{editing ? "Sửa template" : "Tạo template"}</div>
            <div className="text-xs text-muted-foreground">
              {editing ? "Cập nhật mẫu prompt dùng chung" : "Mẫu prompt dùng chung cho toàn tổ chức"}
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label="Đóng">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        {/* form */}
        <div className="space-y-4 overflow-y-auto p-4">
          {/* live preview */}
          <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
            <IconTile icon={icon} size={36} tone="primary" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{title.trim() || "Template mới"}</div>
              <span className="text-2xs text-muted-foreground">{cat}</span>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {desc.trim() || "Mô tả ngắn về mục đích của template."}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tiêu đề</Label>
            <div className="relative">
              <Icon name="scroll-text" className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Review Pull Request" className="pl-9" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Danh mục</Label>
            <div className="relative">
              <Icon name="grid-3x3" className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className="h-9 w-full appearance-none rounded-md border bg-background pl-9 pr-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-1"
              >
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <Icon name="chevron-down" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Biểu tượng</Label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  aria-label={ic}
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
                    ic === icon
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon name={ic} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mô tả ngắn</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Phân tích diff, gắn cờ rủi ro và đề xuất sửa đổi." />
            <p className="text-2xs text-muted-foreground">Hiển thị trên thẻ template — giữ ngắn gọn, một dòng.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Nội dung prompt</Label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder={"Bạn là reviewer cấp cao. Hãy phân tích diff sau:\n{{diff}}\n\n- Gắn cờ rủi ro bảo mật\n- Đề xuất sửa đổi cụ thể"}
              className="border-input w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-xs leading-relaxed shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-1"
            />
            <p className="text-2xs text-muted-foreground">
              Dùng <span className="font-mono">{"{{biến}}"}</span> cho phần thay thế khi chạy.
            </p>
          </div>

          {error && (
            <p className="flex items-center gap-1 text-2xs text-destructive">
              <Icon name="circle-alert" className="h-3 w-3" />{error}
            </p>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 border-t p-4">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button onClick={() => void submit()} disabled={!canSave}>
            <Icon name={editing ? "check" : "plus"} className="h-4 w-4" />
            {editing ? "Lưu thay đổi" : "Tạo template"}
          </Button>
        </div>
      </div>
    </div>
  );
}
