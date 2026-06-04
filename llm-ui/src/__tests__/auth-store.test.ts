import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth-store';
import { DEMO_USER } from '@/mocks/fixtures/users';

describe('auth-store', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts empty', () => {
    const s = useAuthStore.getState();
    expect(s.accessToken).toBeNull();
    expect(s.user).toBeNull();
    expect(s.expiresAt).toBeNull();
  });

  it('setSession stores token, user, and computed expiry', () => {
    useAuthStore.getState().setSession({
      accessToken: 'token-abc',
      user: DEMO_USER,
      expiresInSec: 60,
    });
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe('token-abc');
    expect(s.user).toEqual(DEMO_USER);
    expect(s.expiresAt).toBeGreaterThan(Date.now());
  });

  it('clear resets state', () => {
    useAuthStore.getState().setSession({
      accessToken: 'token-abc',
      user: DEMO_USER,
      expiresInSec: 60,
    });
    useAuthStore.getState().clear();
    const s = useAuthStore.getState();
    expect(s.accessToken).toBeNull();
    expect(s.user).toBeNull();
    expect(s.expiresAt).toBeNull();
  });

  it('does not persist to localStorage', () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem');
    useAuthStore.getState().setSession({
      accessToken: 'token-abc',
      user: DEMO_USER,
      expiresInSec: 60,
    });
    const wroteAuthKey = setSpy.mock.calls.some(([key]) =>
      String(key).toLowerCase().includes('auth'),
    );
    expect(wroteAuthKey).toBe(false);
  });
});
