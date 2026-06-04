import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { OrgSections } from '@/components/sidebar/org-sections';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarUiStore } from '@/stores/sidebar-ui-store';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_USER,
  DEMO_MEMBER_USER,
  DEMO_EXPIRES_IN_SEC,
} from '@/mocks/fixtures/users';

function renderSections() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <OrgSections />
    </QueryClientProvider>,
  );
}

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

function resetStores() {
  useAuthStore.getState().clear();
  useSidebarUiStore.setState({ context: 'org', collapsed: false });
}

describe('OrgSections', () => {
  beforeEach(resetStores);
  afterEach(resetStores);

  it('renders nothing for an org member', () => {
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_MEMBER_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
    const { container } = renderSections();
    expect(container.firstChild).toBeNull();
  });

  it('renders the four built items as links to /admin/org for an org admin', () => {
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
    renderSections();

    const built = ['Workspaces', 'Users', 'Providers', 'Template Library'];
    for (const label of built) {
      const link = screen.getByRole('link', { name: label });
      expect(link).toHaveAttribute('href', '/admin/org');
    }
  });

  it('renders the three stub items as disabled "Coming soon" entries', () => {
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
    renderSections();

    for (const label of ['Usage & Billing', 'Audit Log', 'Org Settings']) {
      const btn = screen.getByRole('button', { name: new RegExp(label, 'i') });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('exposes a "Back to Workspace" affordance', () => {
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
    renderSections();
    expect(
      screen.getByRole('button', { name: /back to workspace/i }),
    ).toBeInTheDocument();
  });
});
