import { http, HttpResponse, delay } from 'msw';
import type { SessionUser } from '@/schemas/auth';
import { LoginRequest } from '@/schemas/auth';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_EXPIRES_IN_SEC,
  DEMO_OWNER_ACCESS_TOKEN,
  DEMO_OWNER_PASSWORD,
  DEMO_OWNER_REFRESH_COOKIE,
  DEMO_OWNER_USER,
  DEMO_PASSWORD,
  DEMO_REFRESH_COOKIE,
  DEMO_USER,
} from '../fixtures/users';

interface DemoAccount {
  user: SessionUser;
  password: string;
  accessToken: string;
  refreshCookie: string;
}

const ACCOUNTS: DemoAccount[] = [
  {
    user: DEMO_USER,
    password: DEMO_PASSWORD,
    accessToken: DEMO_ACCESS_TOKEN,
    refreshCookie: DEMO_REFRESH_COOKIE,
  },
  {
    user: DEMO_OWNER_USER,
    password: DEMO_OWNER_PASSWORD,
    accessToken: DEMO_OWNER_ACCESS_TOKEN,
    refreshCookie: DEMO_OWNER_REFRESH_COOKIE,
  },
];

// MSW's in-memory cookie store does not survive a full page reload, so the
// HttpOnly refresh cookie a real backend would persist is lost. Mirror that
// durability with localStorage so session restore works after a hard reload.
const SESSION_KEY = 'msw:demo-session';

const persistSession = (account: DemoAccount) => {
  try {
    globalThis.localStorage?.setItem(SESSION_KEY, account.user.id);
  } catch {
    /* localStorage unavailable — fall back to cookie-only behavior */
  }
};

const clearPersistedSession = () => {
  try {
    globalThis.localStorage?.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
};

const readPersistedAccount = (): DemoAccount | undefined => {
  try {
    const id = globalThis.localStorage?.getItem(SESSION_KEY);
    return id ? ACCOUNTS.find((a) => a.user.id === id) : undefined;
  } catch {
    return undefined;
  }
};

const setCookie = (refreshCookie: string) =>
  `refreshToken=${refreshCookie}; Path=/; HttpOnly; SameSite=Strict`;

const sessionResponse = (account: DemoAccount) =>
  HttpResponse.json(
    {
      accessToken: account.accessToken,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
      user: account.user,
    },
    { status: 200, headers: { 'Set-Cookie': setCookie(account.refreshCookie) } },
  );

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    await delay(200);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return HttpResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
    }
    const parsed = LoginRequest.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
    }
    const account = ACCOUNTS.find(
      (a) =>
        a.user.email.toLowerCase() === parsed.data.email.toLowerCase() &&
        a.password === parsed.data.password,
    );
    if (!account) {
      return HttpResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
    }
    persistSession(account);
    return sessionResponse(account);
  }),

  http.post('/api/auth/refresh', async ({ request }) => {
    await delay(150);
    const cookie = request.headers.get('cookie') ?? '';
    const account =
      ACCOUNTS.find((a) => cookie.includes(`refreshToken=${a.refreshCookie}`)) ??
      readPersistedAccount();
    if (!account) {
      return HttpResponse.json({ error: 'NO_SESSION' }, { status: 401 });
    }
    return sessionResponse(account);
  }),

  http.post('/api/auth/logout', async () => {
    await delay(100);
    clearPersistedSession();
    return HttpResponse.json(
      { ok: true },
      {
        status: 200,
        headers: { 'Set-Cookie': 'refreshToken=; Path=/; Max-Age=0; HttpOnly' },
      },
    );
  }),
];
