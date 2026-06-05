import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { RoleBreakdownCard } from '@/components/rbac/overview/role-breakdown-card';
import { deriveOrgRoleStats } from '@/lib/derive-org-role-stats';
import type { OrgUserRow } from '@/schemas/admin';
import type { Workspace } from '@/schemas/workspace';

const ADMIN_USERS: OrgUserRow[] = [
  {
    id: 'u-1',
    email: 'ada.lovelace@demo.example',
    status: 'active',
    joinedAt: '2026-01-15T09:00:00.000Z',
  },
  {
    id: 'u-2',
    email: 'grace.hopper@demo.example',
    status: 'pending',
    joinedAt: '2026-02-08T14:30:00.000Z',
  },
  {
    id: 'u-3',
    email: 'alan.turing@demo.example',
    status: 'disabled',
    joinedAt: '2025-11-20T11:15:00.000Z',
  },
];

const OWNER_WS: Workspace[] = [
  { id: 'wsp_a', name: 'Alpha', slug: 'alpha', role: 'owner' },
];

const MEMBER_WS: Workspace[] = [
  { id: 'wsp_b', name: 'Beta', slug: 'beta', role: 'member' },
];

describe('RoleBreakdownCard', () => {
  it('renders the Vietnamese heading and description', () => {
    render(<RoleBreakdownCard stats={deriveOrgRoleStats([], [])} />);
    expect(
      screen.getByRole('heading', { name: 'Vai trò cấp tổ chức' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/tách biệt với vai trò trong từng workspace/i),
    ).toBeInTheDocument();
  });

  it('renders an empty state when no members are present', () => {
    render(<RoleBreakdownCard stats={deriveOrgRoleStats([], OWNER_WS)} />);
    expect(
      screen.getByText('Chưa có thành viên trong tổ chức.'),
    ).toBeInTheDocument();
  });

  it('shows skeleton placeholders while loading', () => {
    const { container } = render(
      <RoleBreakdownCard stats={[]} loading={true} />,
    );
    expect(
      container.querySelector('[data-slot="role-breakdown-loading"]'),
    ).not.toBeNull();
  });

  it('buckets active members into the highest available role and ignores disabled users', () => {
    const stats = deriveOrgRoleStats(ADMIN_USERS, OWNER_WS);
    render(<RoleBreakdownCard stats={stats} />);

    const ownerCount = stats.find((s) => s.role === 'owner')?.count;
    expect(ownerCount).toBe(2);
    expect(screen.getByText(/· 2 người/)).toBeInTheDocument();
    expect(screen.queryByText(/turing/i)).not.toBeInTheDocument();
  });

  it('demotes users to member when no owner/admin workspace exists', () => {
    const stats = deriveOrgRoleStats(ADMIN_USERS, MEMBER_WS);
    const memberStat = stats.find((s) => s.role === 'member');
    expect(memberStat?.count).toBe(2);
    expect(stats.find((s) => s.role === 'owner')?.count).toBe(0);
  });

  it('is exposed as a region with the Vietnamese aria-label', () => {
    render(<RoleBreakdownCard stats={deriveOrgRoleStats([], [])} />);
    expect(
      screen.getByRole('region', { name: 'Vai trò cấp tổ chức' }),
    ).toBeInTheDocument();
  });
});
