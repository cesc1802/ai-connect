import * as React from 'react';
import { LayersIcon, MailIcon } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { RoleBadge } from '@/components/rbac/role-badge';
import { cn } from '@/lib/utils';
import { useUserMemberships } from '@/hooks/use-user-memberships';
import type { OrgUserRow } from '@/schemas/admin';

interface MemberDetailDrawerProps {
  user: OrgUserRow | null;
  onOpenChange: (open: boolean) => void;
  onDisableClick: (user: OrgUserRow) => void;
}

export function MemberDetailDrawer({
  user,
  onOpenChange,
  onDisableClick,
}: MemberDetailDrawerProps) {
  const open = user !== null;
  const { data: memberships, isLoading } = useUserMemberships(
    user ? user.id : null,
  );

  const count = memberships.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-slot="member-detail-drawer"
        className="w-full overflow-y-auto sm:max-w-md"
      >
        {user ? (
          <>
            <SheetHeader className="border-b">
              <SheetTitle className="text-sm font-semibold">
                Hồ sơ thành viên
              </SheetTitle>
              <SheetDescription className="flex items-center gap-1.5 text-sm">
                <MailIcon aria-hidden={true} className="size-3.5" />
                {user.email}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 p-5">
              <section>
                <h3 className="text-muted-foreground mb-2 text-2xs font-semibold uppercase tracking-wider">
                  Vai trò tổ chức
                </h3>
                <div
                  className={cn(
                    'bg-background flex items-start gap-3 rounded-lg border p-3',
                  )}
                >
                  <span
                    aria-label="Chưa có vai trò org"
                    className="text-muted-foreground text-sm"
                  >
                    —
                  </span>
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-muted-foreground text-2xs font-semibold uppercase tracking-wider">
                    Vai trò theo workspace
                  </h3>
                  <span
                    className="text-muted-foreground text-2xs"
                    data-testid="member-detail-ws-count"
                  >
                    {count} workspace
                  </span>
                </div>
                {isLoading ? (
                  <p className="text-muted-foreground text-xs">Đang tải…</p>
                ) : count === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs">
                    <span className="text-muted-foreground">
                      Chưa tham gia workspace nào.
                    </span>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {memberships.map(({ workspace, role }) => (
                      <li
                        key={`${workspace.id}-${role}`}
                        data-slot="member-membership-row"
                        className="bg-background flex items-center gap-3 rounded-lg border p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {workspace.name}
                          </div>
                          <div className="text-muted-foreground truncate text-xs">
                            {workspace.slug}
                          </div>
                        </div>
                        <RoleBadge role={role} />
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-muted-foreground mt-2 text-2xs">
                  Vai trò workspace độc lập với nhau — một người có thể là Dev
                  ở dự án này và PM ở dự án khác.
                </p>
              </section>

              <div className="flex flex-col gap-2 border-t pt-4">
                <Button asChild variant="outline" className="w-full">
                  <a
                    href={`/admin/org/assignment?user=${encodeURIComponent(user.id)}`}
                    data-testid="member-detail-assign-link"
                  >
                    <LayersIcon aria-hidden={true} className="size-4" />
                    Thêm vào workspace
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={user.status === 'disabled'}
                  onClick={() => onDisableClick(user)}
                  data-testid="member-detail-disable"
                >
                  Vô hiệu hoá người dùng
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
