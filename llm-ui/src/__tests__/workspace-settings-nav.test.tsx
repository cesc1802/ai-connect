import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { WorkspaceSettingsNav } from '@/components/sidebar/workspace-settings-nav';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useAuthStore } from '@/stores/auth-store';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_USER,
  DEMO_MEMBER_USER,
  DEMO_EXPIRES_IN_SEC,
} from '@/mocks/fixtures/users';

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>(
      '@tanstack/react-router',
    );
  return {
    ...actual,
    Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
      <a href={to} {...(rest as object)}>
        {children}
      </a>
    ),
  };
});

describe('WorkspaceSettingsNav', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
    useActiveWorkspaceStore.getState().clear();
  });
  afterEach(() => {
    useAuthStore.getState().clear();
    useActiveWorkspaceStore.getState().clear();
  });

  it('renders nothing for a member', () => {
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_MEMBER_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
    useActiveWorkspaceStore
      .getState()
      .setActiveWorkspace('wsp_research', 'member');
    const { container } = render(<WorkspaceSettingsNav />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all five entries for admin and links to /admin/workspace', () => {
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
    useActiveWorkspaceStore.getState().setActiveWorkspace('wsp_acme', 'admin');

    render(<WorkspaceSettingsNav />);
    const expected = ['Members', 'Providers', 'Templates', 'Usage', 'Settings'];
    for (const label of expected) {
      const link = screen.getByRole('link', { name: label });
      expect(link).toHaveAttribute('href', '/admin/workspace');
    }
  });

  it('renders settings nav for an owner as well', () => {
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: { ...DEMO_USER, workspaceRole: 'owner' },
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
    useActiveWorkspaceStore.getState().setActiveWorkspace('wsp_personal', 'owner');
    render(<WorkspaceSettingsNav />);
    expect(screen.getByRole('link', { name: 'Members' })).toBeInTheDocument();
  });
});
