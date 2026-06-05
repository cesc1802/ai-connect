import { ChevronRight } from 'lucide-react';

import { AvatarStack } from '@/components/rbac/avatar-stack';
import { RoleBadge } from '@/components/rbac/role-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { OrgRoleStat } from '@/lib/derive-org-role-stats';

interface RoleBreakdownCardProps {
  stats: OrgRoleStat[];
  loading?: boolean;
  onManageClick?: () => void;
  className?: string;
}

export function RoleBreakdownCard({
  stats,
  loading = false,
  onManageClick,
  className,
}: RoleBreakdownCardProps) {
  const hasMembers = stats.some((s) => s.count > 0);
  return (
    <section
      data-slot="role-breakdown-card"
      aria-label="Vai trò cấp tổ chức"
      className={cn(
        'bg-card border-border rounded-xl border p-5',
        className,
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-semibold">Vai trò cấp tổ chức</h3>
        <button
          type="button"
          onClick={onManageClick}
          className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          Quản lý <ChevronRight className="size-3" aria-hidden={true} />
        </button>
      </div>
      <p className="text-muted-foreground mb-2 text-xs">
        Quyền quản trị nền tảng — tách biệt với vai trò trong từng workspace.
      </p>
      {loading ? (
        <RoleBreakdownLoading />
      ) : hasMembers ? (
        <ul className="divide-border divide-y" role="list">
          {stats.map((stat) => (
            <RoleBreakdownRow key={stat.role} stat={stat} />
          ))}
        </ul>
      ) : (
        <p
          data-slot="role-breakdown-empty"
          className="text-muted-foreground py-6 text-center text-sm"
        >
          Chưa có thành viên trong tổ chức.
        </p>
      )}
    </section>
  );
}

function RoleBreakdownRow({ stat }: { stat: OrgRoleStat }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <RoleBadge role={stat.role} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium">{stat.label}</span>
          <span className="text-muted-foreground text-xs">
            · {stat.count} người
          </span>
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {stat.description}
        </p>
        {stat.count > 0 ? (
          <div className="mt-2">
            <AvatarStack
              users={stat.members}
              max={5}
              size={22}
              ariaLabel={`${stat.label}: ${stat.count} thành viên`}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}

function RoleBreakdownLoading() {
  return (
    <div className="space-y-3" data-slot="role-breakdown-loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-3 py-3">
          <Skeleton className="size-5 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}
