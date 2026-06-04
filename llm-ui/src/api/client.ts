import type { ZodTypeAny, z } from 'zod';
import { useAuthStore } from '@/stores/auth-store';
import { RefreshResponse } from '@/schemas/auth';
import { ApiError, AuthError, NetworkError, ParseError } from './errors';

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

type FetchOpts = Omit<RequestInit, 'body'> & {
  body?: unknown;
  skipAuth?: boolean;
  skipRefresh?: boolean;
};

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) {
    return API_BASE_URL.endsWith('/')
      ? API_BASE_URL.slice(0, -1) + path
      : API_BASE_URL + path;
  }
  return `${API_BASE_URL}/${path}`;
}

function authHeaders(skipAuth: boolean | undefined): HeadersInit {
  if (skipAuth) return {};
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function attemptRefresh(): Promise<boolean> {
  try {
    const res = await fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return false;
    const json = (await res.json()) as unknown;
    const parsed = RefreshResponse.safeParse(json);
    if (!parsed.success) return false;
    useAuthStore.getState().setSession({
      accessToken: parsed.data.accessToken,
      user: parsed.data.user,
      expiresInSec: parsed.data.expiresInSec,
    });
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<S extends ZodTypeAny>(
  path: string,
  opts: FetchOpts,
  schema: S,
): Promise<z.infer<S>> {
  const url = buildUrl(path);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(authHeaders(opts.skipAuth) as Record<string, string>),
    ...((opts.headers as Record<string, string>) ?? {}),
  };

  const init: RequestInit = {
    ...opts,
    headers,
    credentials: opts.credentials ?? 'include',
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  };

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new NetworkError('Network request failed', err);
  }

  if (res.status === 401 && !opts.skipRefresh && !opts.skipAuth) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      return apiFetch(path, { ...opts, skipRefresh: true }, schema);
    }
    useAuthStore.getState().clear();
    throw new AuthError('Session expired');
  }

  let json: unknown = null;
  const text = await res.text();
  if (text.length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new ParseError('Response was not valid JSON');
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, `HTTP ${res.status}`, json);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ParseError('Response did not match schema', parsed.error.issues);
  }
  return parsed.data;
}
