import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { RoleBadge, roleBadgeClasses } from '@/components/rbac/role-badge';
import type { WorkspaceRole } from '@/schemas/workspace';

const CASES: Array<[WorkspaceRole, string, string]> = [
  ['owner', 'Owner', 'bg-primary'],
  ['admin', 'Admin', 'bg-warning'],
  ['member', 'Member', 'bg-chart-2'],
  ['viewer', 'Viewer', 'bg-muted'],
];

describe('RoleBadge', () => {
  it.each(CASES)(
    'renders %s with the expected tint class',
    (role, label, expectedClass) => {
      const { container } = render(<RoleBadge role={role} />);
      const badge = container.querySelector('[data-slot="role-badge"]')!;
      expect(badge.getAttribute('data-role')).toBe(role);
      expect(badge.className).toContain(expectedClass);
      expect(screen.getByText(label)).toBeInTheDocument();
    },
  );

  it('exports a roleBadgeClasses helper for inline reuse', () => {
    expect(roleBadgeClasses('owner')).toContain('bg-primary');
    expect(roleBadgeClasses('viewer')).toContain('bg-muted');
  });

  it('supports custom children', () => {
    render(<RoleBadge role="admin">Quản trị</RoleBadge>);
    expect(screen.getByText('Quản trị')).toBeInTheDocument();
  });
});
