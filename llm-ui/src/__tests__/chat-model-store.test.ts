import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useChatModelStore } from '@/stores/chat-model-store';
import { useAuthStore } from '@/stores/auth-store';
import { DEMO_ACCESS_TOKEN, DEMO_EXPIRES_IN_SEC, DEMO_USER } from '@/mocks/fixtures/users';

const STORAGE_KEY = 'chat-model-selection';

describe('chat-model-store', () => {
  beforeEach(() => {
    useChatModelStore.getState().clearAll();
    useAuthStore.getState().clear();
    localStorage.clear();
  });

  afterEach(() => {
    useChatModelStore.getState().clearAll();
    useAuthStore.getState().clear();
    localStorage.clear();
  });

  it('setModel + getModel round-trip per workspace', () => {
    const store = useChatModelStore.getState();
    store.setModel('wsp_personal', { providerId: 'prv_a', modelId: 'm1' });
    store.setModel('wsp_acme', { providerId: 'prv_b', modelId: 'm2' });

    expect(useChatModelStore.getState().getModel('wsp_personal')).toEqual({
      providerId: 'prv_a',
      modelId: 'm1',
    });
    expect(useChatModelStore.getState().getModel('wsp_acme')).toEqual({
      providerId: 'prv_b',
      modelId: 'm2',
    });
  });

  it('getModel returns null when no selection exists for the workspace', () => {
    expect(useChatModelStore.getState().getModel('wsp_unknown')).toBeNull();
  });

  it('persists selection to localStorage and survives a re-read of storage', () => {
    useChatModelStore.getState().setModel('wsp_personal', {
      providerId: 'prv_a',
      modelId: 'gpt-4o',
    });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { state: { byWorkspace: Record<string, unknown> } };
    expect(parsed.state.byWorkspace.wsp_personal).toEqual({
      providerId: 'prv_a',
      modelId: 'gpt-4o',
    });
  });

  it('clearAll empties byWorkspace', () => {
    useChatModelStore.getState().setModel('wsp_personal', {
      providerId: 'prv_a',
      modelId: 'm1',
    });
    useChatModelStore.getState().clearAll();
    expect(useChatModelStore.getState().byWorkspace).toEqual({});
    expect(useChatModelStore.getState().getModel('wsp_personal')).toBeNull();
  });

  it('clears selection when auth transitions from truthy accessToken to null', () => {
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
    useChatModelStore.getState().setModel('wsp_personal', {
      providerId: 'prv_a',
      modelId: 'm1',
    });
    expect(useChatModelStore.getState().getModel('wsp_personal')).not.toBeNull();

    useAuthStore.getState().clear();

    expect(useChatModelStore.getState().byWorkspace).toEqual({});
  });

  it('does NOT clear selection if accessToken was already null (no truthy→null edge)', () => {
    expect(useAuthStore.getState().accessToken).toBeNull();
    useChatModelStore.getState().setModel('wsp_personal', {
      providerId: 'prv_a',
      modelId: 'm1',
    });
    useAuthStore.getState().clear();
    expect(useChatModelStore.getState().getModel('wsp_personal')).toEqual({
      providerId: 'prv_a',
      modelId: 'm1',
    });
  });
});
