import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { AuthBootstrap } from '@/pages/auth-bootstrap';
import { server } from '@/mocks/server';
import { useAuthStore } from '@/stores/auth-store';
import { DEMO_ACCESS_TOKEN, DEMO_EXPIRES_IN_SEC, DEMO_USER } from '@/mocks/fixtures/users';

describe('AuthBootstrap', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
  });
  afterEach(() => {
    useAuthStore.getState().clear();
  });

  it('renders the splash while the refresh attempt is pending', () => {
    server.use(
      http.post('/api/auth/refresh', async () => {
        // Hang indefinitely so we observe the pending state.
        await new Promise(() => undefined);
        return HttpResponse.json({});
      }),
    );

    render(
      <AuthBootstrap>
        <div>app-content</div>
      </AuthBootstrap>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('app-content')).not.toBeInTheDocument();
  });

  it('hydrates the auth store and renders children when refresh returns 200', async () => {
    server.use(
      http.post('/api/auth/refresh', () =>
        HttpResponse.json({
          accessToken: DEMO_ACCESS_TOKEN,
          expiresInSec: DEMO_EXPIRES_IN_SEC,
          user: DEMO_USER,
        }),
      ),
    );

    render(
      <AuthBootstrap>
        <div>app-content</div>
      </AuthBootstrap>,
    );

    expect(await screen.findByText('app-content')).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe(DEMO_ACCESS_TOKEN);
    expect(useAuthStore.getState().user?.email).toBe(DEMO_USER.email);
  });

  it('leaves the auth store empty and still renders children when refresh returns 401', async () => {
    server.use(
      http.post('/api/auth/refresh', () =>
        HttpResponse.json({ error: 'NO_SESSION' }, { status: 401 }),
      ),
    );

    render(
      <AuthBootstrap>
        <div>app-content</div>
      </AuthBootstrap>,
    );

    expect(await screen.findByText('app-content')).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
