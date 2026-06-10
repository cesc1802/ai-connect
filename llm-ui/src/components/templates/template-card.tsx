import { IconTile } from "@/components/widgets/icon-tile";
import { Avatar } from "@/components/widgets/avatar";
import { Icon } from "@/lib/icons";
import { USERS } from "@/lib/mock-data";
import type { PromptTemplate } from "@/lib/workspace-templates-api";

type Props = {
  t: PromptTemplate;
  onEdit: (t: PromptTemplate) => void;
  onDelete: (t: PromptTemplate) => void;
};

// Library template card — icon tile + title/category, hover actions
// (edit / copy / delete), two-line description, author + usage footer.
export function TemplateCard({ t, onEdit, onDelete }: Props) {
  const author = USERS.find((u) => u.name === t.authorName);

  function copyPrompt() {
    void navigator.clipboard?.writeText(t.body ?? t.description ?? "");
  }

  return (
    <div
      onClick={() => onEdit(t)}
      className="group flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <IconTile icon={t.icon ?? "scroll-text"} size={36} tone="primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{t.title}</div>
          <span className="text-2xs text-muted-foreground">{t.category}</span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(t); }}
            title="Sửa template"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Icon name="square-pen" className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); copyPrompt(); }}
            title="Sao chép"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Icon name="copy" className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(t); }}
            title="Xoá template"
            className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Icon name="trash-2" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
      <div className="mt-auto flex items-center justify-between border-t pt-2.5">
        <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          {author ? <Avatar user={author} size={16} /> : <Icon name="user" className="h-3.5 w-3.5" />}
          {t.authorName}
        </span>
        <span className="flex items-center gap-1 text-2xs text-muted-foreground">
          <Icon name="zap" className="h-3 w-3" />
          {t.uses.toLocaleString("vi-VN")} lượt
        </span>
      </div>
    </div>
  );
}
