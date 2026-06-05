import { Cpu, FolderKanban, ScrollText, Users } from 'lucide-react';

import { StatCard } from '@/components/rbac/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface OverviewStatsRowProps {
  memberCount: number;
  memberActiveCount: number;
  memberPendingCount: number;
  workspaceCount: number;
  workspaceMembershipCount: number;
  providerCount: number;
  providerNames: string[];
  templateCount: number;
  loading?: boolean;
  className?: string;
}

export function OverviewStatsRow({
  memberCount,
  memberActiveCount,
  memberPendingCount,
  workspaceCount,
  workspaceMembershipCount,
  providerCount,
  providerNames,
  templateCount,
  loading = false,
  className,
}: OverviewStatsRowProps) {
  return (
    <section
      data-slot="overview-stats-row"
      aria-label="Chỉ số tổng quan"
      className={cn(
        'grid grid-cols-2 gap-4 lg:grid-cols-4',
        className,
      )}
    >
      <StatCard
        label="Thành viên"
        icon={Users}
        value={loading ? <Skeleton className="h-7 w-12" /> : memberCount}
        delta={
          loading
            ? undefined
            : {
                value: `${memberActiveCount} active · ${memberPendingCount} mời`,
                trend: 'flat',
              }
        }
      />
      <StatCard
        label="Workspace"
        icon={FolderKanban}
        value={loading ? <Skeleton className="h-7 w-12" /> : workspaceCount}
        delta={
          loading
            ? undefined
            : {
                value: `${workspaceMembershipCount} lượt tham gia`,
                trend: 'flat',
              }
        }
      />
      <StatCard
        label="Providers"
        icon={Cpu}
        value={loading ? <Skeleton className="h-7 w-12" /> : providerCount}
        delta={
          loading
            ? undefined
            : {
                value:
                  providerNames.length > 0
                    ? providerNames.join(' · ')
                    : 'Chưa có provider',
                trend: 'flat',
              }
        }
      />
      <StatCard
        label="Prompt Templates"
        icon={ScrollText}
        value={loading ? <Skeleton className="h-7 w-12" /> : templateCount}
        delta={{ value: 'dùng chung toàn org', trend: 'flat' }}
      />
    </section>
  );
}
