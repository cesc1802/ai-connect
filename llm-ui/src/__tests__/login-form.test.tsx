import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { LoginForm } from '@/components/auth/login-form';
import { useAuthStore } from '@/stores/auth-store';
import { server } from '@/mocks/server';
import { DEMO_PASSWORD, DEMO_USER } from '@/mocks/fixtures/users';

const navigateSpy = vi.fn();
vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>(
      '@tanstack/react-router',
    );
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginForm />
    </QueryClientProvider>,
  );
}

describe('LoginForm', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    useAuthStore.getState().clear();
  });
  afterEach(() => {
    useAuthStore.getState().clear();
  });

  it('shows a Zod error when the email is invalid', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'longenoughpw');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('logs in and navigates to /workspaces/pick on valid submit', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/email/i), DEMO_USER.email);
    await user.type(screen.getByLabelText(/password/i), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await vi.waitFor(() => {
      expect(useAuthStore.getState().accessToken).not.toBeNull();
    });
    expect(useAuthStore.getState().user?.email).toBe(DEMO_USER.email);
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/workspaces/pick' });
  });

  it('shows server-side error for invalid credentials (401)', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/email/i), DEMO_USER.email);
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByText(/invalid email or password/i),
    ).toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
