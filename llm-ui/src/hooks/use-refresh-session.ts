import { useEffect, useState } from 'react';
import { refresh } from '@/api/auth';
import { useAuthStore } from '@/stores/auth-store';

type Status = 'pending' | 'ready';

/**
 * One-shot session restore on app boot.
 * - If refresh succeeds: hydrate accessToken into auth store.
 * - If refresh fails (no cookie / 401 / network): leave store empty.
 * Always resolves to 'ready' so the router can render either way.
 *
 * Note: user identity is NOT re-fetched here; refresh only renews the token.
 * If a user object is needed before /login redirect kicks in, expand the
 * `/auth/refresh` payload — out of scope for Phase 5.
 */
export function useRefreshSession(): { status: Status } {
  const [status, setStatus] = useState<Status>('pending');

  useEffect(() => {
    let cancelled = false;
    refresh()
      .then((res) => {
        if (cancelled) return;
        useAuthStore.getState().setSession({
          accessToken: res.accessToken,
          user: res.user,
          expiresInSec: res.expiresInSec,
        });
      })
      .catch(() => {
        // Swallow: no refresh cookie or expired session — router handles redirect.
      })
      .finally(() => {
        if (!cancelled) setStatus('ready');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { status };
}
