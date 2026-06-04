import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { ChatSection } from '@/components/sidebar/chat-section';
import { server } from '@/mocks/server';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useAuthStore } from '@/stores/auth-store';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_USER,
  DEMO_EXPIRES_IN_SEC,
} from '@/mocks/fixtures/users';
import type { Conversation } from '@/schemas/conversation';

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
    Link: ({ children, ...rest }: { children: React.ReactNode }) => (
      <a {...(rest as object)}>{children}</a>
    ),
  };
});

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ChatSection />
    </QueryClientProvider>,
  );
}

function offsetIso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function fixture(): Conversation[] {
  return [
    {
      id: 'cv_today_1',
      workspaceId: 'wsp_acme',
      title: 'Sprint Sync',
      createdAt: offsetIso(0),
      updatedAt: offsetIso(0),
    },
    {
      id: 'cv_yesterday_1',
      workspaceId: 'wsp_acme',
      title: 'Bug Triage',
      createdAt: offsetIso(1),
      updatedAt: offsetIso(1),
    },
    {
      id: 'cv_5d_1',
      workspaceId: 'wsp_acme',
      title: 'Roadmap Notes',
      createdAt: offsetIso(5),
      updatedAt: offsetIso(5),
    },
    {
      id: 'cv_old_1',
      workspaceId: 'wsp_acme',
      title: 'Onboarding Doc',
      createdAt: offsetIso(20),
      updatedAt: offsetIso(20),
    },
  ];
}

describe('ChatSection', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
    useActiveWorkspaceStore.getState().setActiveWorkspace('wsp_acme', 'admin');
  });

  afterEach(() => {
    useAuthStore.getState().clear();
    useActiveWorkspaceStore.getState().clear();
  });

  it('renders recency buckets with their items', async () => {
    server.use(
      http.get('/api/conversations', () =>
        HttpResponse.json({ conversations: fixture() }),
      ),
    );
    renderSection();
    expect(await screen.findByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('Older')).toBeInTheDocument();
    expect(screen.getByText('Sprint Sync')).toBeInTheDocument();
    expect(screen.getByText('Bug Triage')).toBeInTheDocument();
    expect(screen.getByText('Roadmap Notes')).toBeInTheDocument();
    expect(screen.getByText('Onboarding Doc')).toBeInTheDocument();
  });

  it('filters by title and preserves matched group header', async () => {
    server.use(
      http.get('/api/conversations', () =>
        HttpResponse.json({ conversations: fixture() }),
      ),
    );
    const user = userEvent.setup();
    renderSection();
    await screen.findByText('Sprint Sync');

    await user.type(
      screen.getByRole('searchbox', { name: /search conversations/i }),
      'roadmap',
    );

    expect(screen.getByText('Roadmap Notes')).toBeInTheDocument();
    expect(screen.queryByText('Sprint Sync')).toBeNull();
    expect(screen.queryByText('Today')).toBeNull();
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
  });

  it('shows no-match notice with Clear search', async () => {
    server.use(
      http.get('/api/conversations', () =>
        HttpResponse.json({ conversations: fixture() }),
      ),
    );
    const user = userEvent.setup();
    renderSection();
    await screen.findByText('Sprint Sync');

    await user.type(
      screen.getByRole('searchbox', { name: /search conversations/i }),
      'nothing-matches-this',
    );

    expect(
      screen.getByText(/no conversations match/i),
    ).toBeInTheDocument();
    const clearButtons = screen.getAllByRole('button', { name: 'Clear search' });
    // The no-match notice's button is the text "Clear search" inside a ghost <Button>
    const textButton = clearButtons.find((b) => b.textContent?.includes('Clear search'));
    await user.click(textButton!);
    expect(screen.getByText('Sprint Sync')).toBeInTheDocument();
  });

  it('shows empty state with New Chat button when workspace has none', async () => {
    server.use(
      http.get('/api/conversations', () =>
        HttpResponse.json({ conversations: [] }),
      ),
    );
    const user = userEvent.setup();
    renderSection();
    expect(
      await screen.findByText(/no conversations yet/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /new chat/i }));
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/chat' });
  });
});
