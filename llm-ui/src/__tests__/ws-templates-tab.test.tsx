import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { WsTemplatesTab } from '@/components/admin/workspace/ws-templates-tab';
import {
  resetWsTemplatesHandlers,
  setWsTemplatesBound,
  setWsTemplatesPool,
} from '@/mocks/handlers/admin-ws-templates-handlers';
import { useAuthStore } from '@/stores/auth-store';
import type { SessionUser } from '@/schemas/auth';

function renderTab() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { qc, ...render(<WsTemplatesTab />, { wrapper: Wrapper }) };
}

function setAdminSession() {
  useAuthStore.setState({
    accessToken: 'tok',
    expiresAt: Date.now() + 60_000,
    user: {
      id: 'u1',
      email: 'admin@x.com',
      orgId: 'o1',
      orgRole: 'admin',
      workspaceId: 'w1',
      workspaceRole: 'admin',
    } as SessionUser,
  });
}

describe('WsTemplatesTab', () => {
  beforeEach(() => {
    resetWsTemplatesHandlers();
    setAdminSession();
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, expiresAt: null });
  });

  it('renders available and bound columns from server snapshot', async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('Summarize')).toBeInTheDocument();
    });
    expect(screen.getByText('Translate')).toBeInTheDocument();
    expect(screen.getByText('Extract entities')).toBeInTheDocument();
  });

  it('binds an available template into draft state', async () => {
    renderTab();
    const bindBtn = await screen.findByRole('button', {
      name: 'Bind Translate',
    });
    await userEvent.click(bindBtn);
    expect(
      screen.getByRole('button', { name: 'Unbind Translate' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save bindings' }),
    ).not.toBeDisabled();
  });

  it('save persists bindings and resets dirty state', async () => {
    renderTab();
    const bindBtn = await screen.findByRole('button', {
      name: 'Bind Translate',
    });
    await userEvent.click(bindBtn);
    await userEvent.click(
      screen.getByRole('button', { name: 'Save bindings' }),
    );
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Save bindings' }),
      ).toBeDisabled();
    });
  });

  it('discard reverts to server snapshot', async () => {
    renderTab();
    const bindBtn = await screen.findByRole('button', {
      name: 'Bind Translate',
    });
    await userEvent.click(bindBtn);
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(
      screen.getByRole('button', { name: 'Bind Translate' }),
    ).toBeInTheDocument();
  });

  it('shows the suggested-role select for bound templates', async () => {
    renderTab();
    await waitFor(() => {
      expect(
        screen.getByRole('combobox', {
          name: 'Suggested role for Summarize',
        }),
      ).toBeInTheDocument();
    });
  });

  it('shows empty-pool state with Open Org Admin link for org admin', async () => {
    setWsTemplatesPool([]);
    setWsTemplatesBound([]);
    renderTab();
    expect(
      await screen.findByRole('heading', { name: /No templates in org pool/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open Org Admin' }),
    ).toBeInTheDocument();
  });

  it('is axe-clean', async () => {
    const { container } = renderTab();
    await screen.findByText('Summarize');
    const r = await axe(container);
    const serious = (r.violations ?? []).filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toEqual([]);
  });
});
