import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useApplyTemplate } from '@/hooks/use-apply-template';
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
let mockParams: { conversationId?: string } = {};

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>(
      '@tanstack/react-router',
    );
  return {
    ...actual,
    useNavigate: () => navigateSpy,
    useParams: () => mockParams,
  };
});

const toastSpy = { message: vi.fn() };
vi.mock('sonner', () => ({
  toast: {
    message: (...args: unknown[]) => toastSpy.message(...args),
    error: vi.fn(),
  },
}));

function wrapper(qc: QueryClient) {
  return function Wrap({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function seed() {
  useAuthStore.getState().setSession({
    accessToken: DEMO_ACCESS_TOKEN,
    user: DEMO_USER,
    expiresInSec: DEMO_EXPIRES_IN_SEC,
  });
  useActiveWorkspaceStore.getState().setActiveWorkspace('wsp_acme', 'admin');
}

const T_BASIC: Template = {
  id: 'tpl_basic',
  name: 'Basic',
  scope: 'workspace',
  body: 'Hello there',
};

const T_UNASSIGNED_MODEL: Template = {
  id: 'tpl_unassigned',
  name: 'Unassigned model',
  scope: 'personal',
  body: 'Some body',
  defaultModelId: 'mdl_not_in_workspace',
};

describe('useApplyTemplate', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    toastSpy.message.mockReset();
    mockParams = {};
    useComposerDraftStore.getState().clear();
  });

  afterEach(() => {
    useAuthStore.getState().clear();
    useActiveWorkspaceStore.getState().clear();
    useComposerDraftStore.getState().clear();
  });

  it('with no open chat: seeds composer + navigates to /chat', () => {
    seed();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useApplyTemplate(), { wrapper: wrapper(qc) });
    act(() => result.current(T_BASIC));

    const pending = useComposerDraftStore.getState().pending;
    expect(pending?.mode).toBe('seed');
    expect(pending?.text).toBe('Hello there');
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/chat' });
  });

  it('with open chat: inserts (no navigate)', () => {
    seed();
    mockParams = { conversationId: 'cv_open' };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useApplyTemplate(), { wrapper: wrapper(qc) });
    act(() => result.current(T_BASIC));

    expect(useComposerDraftStore.getState().pending?.mode).toBe('insert');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('unassigned defaultModelId: still applies text + emits notice', () => {
    seed();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['workspaces', 'wsp_acme', 'resources'], {
      providers: [
        {
          id: 'prov_a',
          displayName: 'Anthropic',
          providerKind: 'anthropic',
          isEnabled: true,
          models: [
            { id: 'mdl_in_workspace', displayName: 'Sonnet' },
          ],
        },
      ],
    });
    const { result } = renderHook(() => useApplyTemplate(), { wrapper: wrapper(qc) });
    act(() => result.current(T_UNASSIGNED_MODEL));

    expect(useComposerDraftStore.getState().pending?.text).toBe('Some body');
    expect(toastSpy.message).toHaveBeenCalled();
  });
});
