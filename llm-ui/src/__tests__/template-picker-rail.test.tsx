import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { TemplatePickerRail } from '@/components/chat/template-picker-rail';
import { server } from '@/mocks/server';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useAuthStore } from '@/stores/auth-store';
import { useComposerDraftStore } from '@/stores/composer-draft-store';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_USER,
  DEMO_EXPIRES_IN_SEC,
} from '@/mocks/fixtures/users';
import type { Template } from '@/schemas/template';

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

function fixture(): Template[] {
  return [
    {
      id: 'tpl_ws_1',
      name: 'Bug template',
      scope: 'workspace',
      body: 'A bug occurred',
    },
    {
      id: 'tpl_ws_2',
      name: 'Standup template',
      scope: 'workspace',
      body: 'Yesterday I did',
    },
    {
      id: 'tpl_personal_1',
      name: 'My notes',
      scope: 'personal',
      body: 'Personal note',
    },
    {
      id: 'tpl_suggested_1',
      name: 'Suggested ask',
      scope: 'suggested',
      body: 'Ask me anything',
    },
  ];
}

function renderRail() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TemplatePickerRail />
    </QueryClientProvider>,
  );
}

describe('TemplatePickerRail', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
    useActiveWorkspaceStore.getState().setActiveWorkspace('wsp_acme', 'admin');
    useComposerDraftStore.getState().clear();
  });

  afterEach(() => {
    useAuthStore.getState().clear();
    useActiveWorkspaceStore.getState().clear();
    useComposerDraftStore.getState().clear();
  });

  it('renders Vietnamese scope group labels', async () => {
    server.use(
      http.get('/api/workspaces/:wsId/templates', () =>
        HttpResponse.json({ templates: fixture() }),
      ),
    );
    renderRail();

    expect(await screen.findByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Cá nhân')).toBeInTheDocument();
    expect(screen.getByText('Gợi ý')).toBeInTheDocument();
  });

  it('lists templates in their scope group', async () => {
    server.use(
      http.get('/api/workspaces/:wsId/templates', () =>
        HttpResponse.json({ templates: fixture() }),
      ),
    );
    renderRail();

    expect(await screen.findByText('Bug template')).toBeInTheDocument();
    expect(screen.getByText('Standup template')).toBeInTheDocument();
    expect(screen.getByText('My notes')).toBeInTheDocument();
    expect(screen.getByText('Suggested ask')).toBeInTheDocument();
  });

  it('clicking a template seeds the composer draft and navigates to /chat', async () => {
    server.use(
      http.get('/api/workspaces/:wsId/templates', () =>
        HttpResponse.json({ templates: fixture() }),
      ),
      http.get('/api/workspaces/:wsId/resources', () =>
        HttpResponse.json({ providers: [], models: [] }),
      ),
    );
    const user = userEvent.setup();
    renderRail();

    await user.click(await screen.findByText('Bug template'));

    const pending = useComposerDraftStore.getState().pending;
    expect(pending?.text).toBe('A bug occurred');
    expect(pending?.mode).toBe('seed');
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/chat' });
  });

  it('shows empty notice in Vietnamese when no templates returned', async () => {
    server.use(
      http.get('/api/workspaces/:wsId/templates', () =>
        HttpResponse.json({ templates: [] }),
      ),
    );
    renderRail();

    expect(
      await screen.findByText('Chưa có mẫu nào trong workspace này.'),
    ).toBeInTheDocument();
  });
});
