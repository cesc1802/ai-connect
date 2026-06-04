import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TemplatesSection } from '@/components/sidebar/templates-section';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useAuthStore } from '@/stores/auth-store';
import { useComposerDraftStore } from '@/stores/composer-draft-store';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_USER,
  DEMO_MEMBER_USER,
  DEMO_EXPIRES_IN_SEC,
} from '@/mocks/fixtures/users';

const navigateSpy = vi.fn();
vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>(
      '@tanstack/react-router',
    );
  return {
    ...actual,
    useNavigate: () => navigateSpy,
    useParams: () => ({}),
  };
});

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TemplatesSection />
    </QueryClientProvider>,
  );
}

function seedAdmin() {
  useAuthStore.getState().setSession({
    accessToken: DEMO_ACCESS_TOKEN,
    user: DEMO_USER,
    expiresInSec: DEMO_EXPIRES_IN_SEC,
  });
  useActiveWorkspaceStore.getState().setActiveWorkspace('wsp_acme', 'admin');
}

function seedMember() {
  useAuthStore.getState().setSession({
    accessToken: DEMO_ACCESS_TOKEN,
    user: DEMO_MEMBER_USER,
    expiresInSec: DEMO_EXPIRES_IN_SEC,
  });
  useActiveWorkspaceStore
    .getState()
    .setActiveWorkspace('wsp_research', 'member');
}

describe('TemplatesSection', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    useComposerDraftStore.getState().clear();
  });

  afterEach(() => {
    useAuthStore.getState().clear();
    useActiveWorkspaceStore.getState().clear();
    useComposerDraftStore.getState().clear();
  });

  it('renders the three scope groups when present', async () => {
    seedAdmin();
    renderSection();
    expect(await screen.findByText(/suggested for you/i)).toBeInTheDocument();
    expect(screen.getByText(/^workspace$/i)).toBeInTheDocument();
    expect(screen.getByText(/my templates/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /brand voice reply/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /quarterly okr draft/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /daily standup/i })).toBeInTheDocument();
  });

  it('shows role-empty guidance for members with no suggested templates', async () => {
    seedMember();
    renderSection();
    expect(
      await screen.findByText(/nothing suggested for your role/i),
    ).toBeInTheDocument();
  });

  it('applying a template (no open chat) seeds composer with seed mode and navigates to /chat', async () => {
    seedAdmin();
    const user = userEvent.setup();
    renderSection();
    await user.click(
      await screen.findByRole('button', { name: /brand voice reply/i }),
    );
    const pending = useComposerDraftStore.getState().pending;
    expect(pending?.mode).toBe('seed');
    expect(pending?.text).toMatch(/brand voice/i);
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/chat' });
  });
});
