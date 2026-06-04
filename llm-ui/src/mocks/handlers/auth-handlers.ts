import { http, HttpResponse, delay } from 'msw';
import { LoginRequest } from '@/schemas/auth';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_EXPIRES_IN_SEC,
  DEMO_PASSWORD,
  DEMO_REFRESH_COOKIE,
  DEMO_USER,
} from '../fixtures/users';

const REFRESH_COOKIE = `refreshToken=${DEMO_REFRESH_COOKIE}; Path=/; HttpOnly; SameSite=Strict`;

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
    if (
      parsed.data.email.toLowerCase() !== DEMO_USER.email.toLowerCase() ||
      parsed.data.password !== DEMO_PASSWORD
    ) {
      return HttpResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
    }
    return HttpResponse.json(
      {
        accessToken: DEMO_ACCESS_TOKEN,
        expiresInSec: DEMO_EXPIRES_IN_SEC,
        user: DEMO_USER,
      },
      { status: 200, headers: { 'Set-Cookie': REFRESH_COOKIE } },
    );
  }),

  http.post('/api/auth/refresh', async ({ request }) => {
    await delay(150);
    const cookie = request.headers.get('cookie') ?? '';
    if (!cookie.includes(`refreshToken=${DEMO_REFRESH_COOKIE}`)) {
      return HttpResponse.json({ error: 'NO_SESSION' }, { status: 401 });
    }
    return HttpResponse.json(
      {
        accessToken: DEMO_ACCESS_TOKEN,
        expiresInSec: DEMO_EXPIRES_IN_SEC,
        user: DEMO_USER,
      },
      { status: 200, headers: { 'Set-Cookie': REFRESH_COOKIE } },
    );
  }),

  http.post('/api/auth/logout', async () => {
    await delay(100);
    return HttpResponse.json(
      { ok: true },
      {
        status: 200,
        headers: { 'Set-Cookie': 'refreshToken=; Path=/; Max-Age=0; HttpOnly' },
      },
    );
  }),
];
