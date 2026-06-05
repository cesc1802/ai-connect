import { useMemo } from 'react';

import { OrgHero } from '@/components/rbac/overview/org-hero';
import { OverviewStatsRow } from '@/components/rbac/overview/overview-stats-row';
import { ProvidersSummaryCard } from '@/components/rbac/overview/providers-summary-card';
import { RoleBreakdownCard } from '@/components/rbac/overview/role-breakdown-card';
import { WorkspacesSummaryCard } from '@/components/rbac/overview/workspaces-summary-card';
import { useOrgProviders } from '@/hooks/use-org-providers';
import { useOrgTemplates } from '@/hooks/use-org-templates';
import { useOrgUsers } from '@/hooks/use-org-users';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { deriveOrgRoleStats } from '@/lib/derive-org-role-stats';
import type { ProviderKind } from '@/schemas/resources';

const PROVIDER_KIND_DISPLAY: Record<ProviderKind, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  'azure-openai': 'Azure OpenAI',
  custom: 'Custom',
};

export function OverviewPage() {
  const users = useOrgUsers();
  const providers = useOrgProviders();
  const templates = useOrgTemplates();
  const workspaces = useWorkspaces();

  const loading =
    users.isPending ||
    providers.isPending ||
    templates.isPending ||
    workspaces.isPending;

  const userRows = users.data ?? [];
  const providerRows = providers.data ?? [];
  const templateRows = templates.data ?? [];
  const workspaceRows = workspaces.data?.workspaces ?? [];

  const roleStats = useMemo(
    () => deriveOrgRoleStats(userRows, workspaceRows),
    [userRows, workspaceRows],
  );

  const memberCount = userRows.length;
  const memberActiveCount = userRows.filter((u) => u.status === 'active').length;
  const memberPendingCount = userRows.filter((u) => u.status === 'pending').length;
  const workspaceCount = workspaceRows.length;
  const workspaceMembershipCount = workspaceRows.length;
  const providerCount = providerRows.length;
  const providerNames = Array.from(
    new Set(providerRows.map((p) => PROVIDER_KIND_DISPLAY[p.providerKind])),
  ).slice(0, 3);
  const templateCount = templateRows.length;

  return (
    <div className="space-y-6 p-4 sm:p-6" data-slot="overview-page">
      <OrgHero
        memberCount={memberCount}
        workspaceCount={workspaceCount}
        loading={loading}
      />

      <OverviewStatsRow
        memberCount={memberCount}
        memberActiveCount={memberActiveCount}
        memberPendingCount={memberPendingCount}
        workspaceCount={workspaceCount}
        workspaceMembershipCount={workspaceMembershipCount}
        providerCount={providerCount}
        providerNames={providerNames}
        templateCount={templateCount}
        loading={loading}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <RoleBreakdownCard
          stats={roleStats}
          loading={users.isPending || workspaces.isPending}
          className="lg:col-span-3"
        />
        <ProvidersSummaryCard
          providers={providerRows}
          loading={providers.isPending}
          className="lg:col-span-2"
        />
      </div>

      <WorkspacesSummaryCard
        workspaces={workspaceRows}
        loading={workspaces.isPending}
      />
    </div>
  );
}
