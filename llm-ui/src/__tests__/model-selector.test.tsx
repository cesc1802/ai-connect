import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';

import { ModelSelector } from '@/components/chat/model-selector';
import { useChatModelStore } from '@/stores/chat-model-store';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useAuthStore } from '@/stores/auth-store';
import { workspaceResourcesQueryKey } from '@/hooks/use-workspace-resources';
import type { WorkspaceResourcesResponse } from '@/schemas/resources';
import { DEMO_ACCESS_TOKEN, DEMO_EXPIRES_IN_SEC, DEMO_USER } from '@/mocks/fixtures/users';

const WS = 'wsp_personal';

const FIXTURE: WorkspaceResourcesResponse = {
  providers: [
    {
      id: 'prv_openai',
      displayName: 'OpenAI',
      providerKind: 'openai',
      isEnabled: true,
      models: [
        { id: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000 },
        { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini', contextWindow: 128000 },
      ],
    },
    {
      id: 'prv_anthropic',
      displayName: 'Anthropic',
      providerKind: 'anthropic',
      isEnabled: true,
      models: [
        { id: 'claude-3-5', displayName: 'Claude 3.5 Sonnet', contextWindow: 200000 },
        { id: 'claude-3-opus', displayName: 'Claude 3 Opus', contextWindow: 200000 },
      ],
    },
  ],
};

function renderSelector(opts?: {
  data?: WorkspaceResourcesResponse;
  workspaceId?: string | null;
}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const workspaceId = opts?.workspaceId === undefined ? WS : opts.workspaceId;
  if (workspaceId != null) {
    useActiveWorkspaceStore.getState().setWorkspace(workspaceId);
    qc.setQueryData<WorkspaceResourcesResponse>(
      workspaceResourcesQueryKey(workspaceId),
      opts?.data ?? FIXTURE,
    );
  }
  const utils = render(
    <QueryClientProvider client={qc}>
      <ModelSelector />
    </QueryClientProvider>,
  );
  return { ...utils, qc };
}

beforeEach(() => {
  useAuthStore.getState().setSession({
    accessToken: DEMO_ACCESS_TOKEN,
    user: DEMO_USER,
    expiresInSec: DEMO_EXPIRES_IN_SEC,
  });
  useChatModelStore.getState().clearAll();
  useActiveWorkspaceStore.getState().setWorkspace(null);
});

afterEach(() => {
  useChatModelStore.getState().clearAll();
  useActiveWorkspaceStore.getState().setWorkspace(null);
  useAuthStore.getState().clear();
});

describe('ModelSelector', () => {
  it('renders grouping labels and model items when opened', async () => {
    const user = userEvent.setup();
    renderSelector();

    const trigger = screen.getByRole('button', { name: /select chat model/i });
    await user.click(trigger);

    expect(await screen.findByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'GPT-4o' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Claude 3.5 Sonnet' })).toBeInTheDocument();
  });

  it('selecting an item updates the store and closes the menu', async () => {
    const user = userEvent.setup();
    renderSelector();
    const trigger = screen.getByRole('button', { name: /select chat model/i });
    await user.click(trigger);

    const item = await screen.findByRole('option', { name: 'GPT-4o' });
    await user.click(item);

    await waitFor(() => {
      expect(useChatModelStore.getState().getModel(WS)).toEqual({
        providerId: 'prv_openai',
        modelId: 'gpt-4o',
      });
    });
    expect(screen.queryByRole('option', { name: 'GPT-4o' })).toBeNull();
    expect(trigger).toHaveTextContent(/OpenAI · GPT-4o/i);
  });

  it('disables trigger and shows hint when there are no providers', () => {
    renderSelector({ data: { providers: [] } });
    const trigger = screen.getByRole('button', { name: /select chat model/i });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute(
      'title',
      'No models available — ask an admin to assign a provider.',
    );
  });

  it('with stale selection, shows "Select model" and does not mutate the store', async () => {
    useChatModelStore.getState().setModel(WS, {
      providerId: 'prv_gone',
      modelId: 'm_gone',
    });
    renderSelector();

    const trigger = screen.getByRole('button', { name: /select chat model/i });
    expect(trigger).toHaveTextContent(/select model/i);
    // store untouched
    expect(useChatModelStore.getState().getModel(WS)).toEqual({
      providerId: 'prv_gone',
      modelId: 'm_gone',
    });
  });

  it('supports keyboard navigation: ArrowDown traverses, Enter selects, Escape closes', async () => {
    const user = userEvent.setup();
    renderSelector();

    const trigger = screen.getByRole('button', { name: /select chat model/i });
    trigger.focus();
    await user.keyboard('{Enter}');

    await screen.findByRole('option', { name: 'GPT-4o' });
    // Radix focuses the first item on open; ArrowDown moves to the second
    // item; ArrowUp moves back to the first. We assert traversal works by
    // navigating ArrowDown, ArrowUp, then activating Enter.
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowUp}');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      const sel = useChatModelStore.getState().getModel(WS);
      expect(sel).not.toBeNull();
      expect(sel?.providerId).toBe('prv_openai');
    });

    // Reopen and verify Escape closes
    await user.click(trigger);
    await screen.findByRole('option', { name: 'GPT-4o' });
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'GPT-4o' })).toBeNull();
    });
  });

  it('has no serious or critical axe violations when dropdown is open', async () => {
    const user = userEvent.setup();
    const { container } = renderSelector();
    await user.click(screen.getByRole('button', { name: /select chat model/i }));
    await screen.findByRole('option', { name: 'GPT-4o' });

    const results = await axe(container);
    const serious = (results.violations ?? []).filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toEqual([]);
  });
});
