import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { login } from '@/api/auth';
import { listWorkspaces } from '@/api/workspaces';
import { useAuthStore } from '@/stores/auth-store';
import { ApiError, AuthError, ParseError } from '@/api/errors';
import { DEMO_PASSWORD, DEMO_USER } from '@/mocks/fixtures/users';

afterEach(() => {
  useAuthStore.getState().clear();
});

describe('apiFetch + helpers', () => {
  it('logs in via MSW and returns a typed response', async () => {
    const res = await login({ email: DEMO_USER.email, password: DEMO_PASSWORD });
    expect(res.user.email).toBe(DEMO_USER.email);
    expect(res.accessToken).toBeTruthy();
    expect(res.expiresInSec).toBeGreaterThan(0);
  });

  it('returns 401 AuthError on bad credentials', async () => {
    await expect(
      login({ email: DEMO_USER.email, password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('attaches Bearer token to outgoing requests', async () => {
    const login_res = await login({
      email: DEMO_USER.email,
      password: DEMO_PASSWORD,
    });
    useAuthStore.getState().setSession({
      accessToken: login_res.accessToken,
      user: login_res.user,
      expiresInSec: login_res.expiresInSec,
    });

    let observed: string | null = null;
    server.use(
      http.get('/api/workspaces', ({ request }) => {
        observed = request.headers.get('authorization');
        return HttpResponse.json({ workspaces: [] });
      }),
    );

    await listWorkspaces();
    expect(observed).toBe(`Bearer ${login_res.accessToken}`);
  });

  it('throws ParseError when response does not match schema', async () => {
    server.use(
      http.get('/api/workspaces', () =>
        HttpResponse.json({ workspaces: [{ id: 'wsp_x' }] }),
      ),
    );
    await expect(listWorkspaces()).rejects.toBeInstanceOf(ParseError);
  });

  it('refreshes once on 401 then retries', async () => {
    let calls = 0;
    server.use(
      http.get('/api/workspaces', () => {
        calls += 1;
        if (calls === 1) return new HttpResponse(null, { status: 401 });
        return HttpResponse.json({ workspaces: [] });
      }),
    );
    useAuthStore.getState().setSession({
      accessToken: 'stale',
      user: DEMO_USER,
      expiresInSec: 1,
    });
    const res = await listWorkspaces();
    expect(res.workspaces).toEqual([]);
    expect(calls).toBe(2);
  });

  it('clears session and throws AuthError when refresh fails', async () => {
    server.use(
      http.get('/api/workspaces', () => new HttpResponse(null, { status: 401 })),
      http.post('/api/auth/refresh', () => new HttpResponse(null, { status: 401 })),
    );
    useAuthStore.getState().setSession({
      accessToken: 'stale',
      user: DEMO_USER,
      expiresInSec: 1,
    });
    await expect(listWorkspaces()).rejects.toBeInstanceOf(AuthError);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
