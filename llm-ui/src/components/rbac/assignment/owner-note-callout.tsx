import { Crown } from 'lucide-react';

export function OwnerNoteCallout() {
  return (
    <div
      data-slot="assignment-owner-note"
      className="border-primary/20 bg-primary/5 mx-auto mb-6 flex max-w-3xl items-start gap-3 rounded-xl border p-4 sm:mx-6"
    >
      <span
        aria-hidden="true"
        className="bg-primary/15 text-primary inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
      >
        <Crown className="h-4 w-4" />
      </span>
      <div className="text-sm">
        <span className="font-medium">Bạn là Org Owner.</span>{' '}
        <span className="text-muted-foreground">
          Chỉ Org Owner và Workspace Admin mới được gán thành viên. Vai trò org
          (Owner/Admin/Member) đổi ở trang Thành viên.
        </span>
      </div>
    </div>
  );
}
