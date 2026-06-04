import { useAuthStore } from '@/stores/auth-store';
import { API_BASE_URL } from './client';
import { ApiError, NetworkError, ParseError } from './errors';
import {
  WsTemplatesResponse,
  type PutWsTemplatesRequest,
} from '@/schemas/admin';

export class WsTemplatesEtagMismatchError extends Error {
  readonly code = 'etag_mismatch';
  constructor() {
    super('Bindings changed');
    this.name = 'WsTemplatesEtagMismatchError';
  }
}

export class WsTemplatesNotInPoolError extends Error {
  readonly code = 'not_in_org_pool';
  constructor(readonly invalidIds: string[]) {
    super(`Not in org pool: ${invalidIds.join(', ')}`);
    this.name = 'WsTemplatesNotInPoolError';
  }
}

export interface WsTemplatesFetchResult {
  data: WsTemplatesResponse;
  etag: string | null;
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) {
    return API_BASE_URL.endsWith('/')
      ? API_BASE_URL.slice(0, -1) + path
      : API_BASE_URL + path;
  }
  return `${API_BASE_URL}/${path}`;
}

function authHeaders(): HeadersInit {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  const url = buildUrl(path);
  try {
    return await fetch(url, {
      ...init,
      credentials: init.credentials ?? 'include',
    });
  } catch (err) {
    throw new NetworkError('Network request failed', err);
  }
}

export async function getWsTemplates(): Promise<WsTemplatesFetchResult> {
  const res = await rawFetch('/admin/workspace/templates', {
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, `HTTP ${res.status}`, body);
  }
  const json = (await res.json()) as unknown;
  const parsed = WsTemplatesResponse.safeParse(json);
  if (!parsed.success) {
    throw new ParseError('Response did not match schema', parsed.error.issues);
  }
  return { data: parsed.data, etag: res.headers.get('ETag') };
}

export async function putWsTemplates(
  body: PutWsTemplatesRequest,
  ifMatch: string | null,
): Promise<WsTemplatesFetchResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(authHeaders() as Record<string, string>),
  };
  if (ifMatch !== null) {
    headers['If-Match'] = ifMatch;
  }
  const res = await rawFetch('/admin/workspace/templates', {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    throw new WsTemplatesEtagMismatchError();
  }
  if (res.status === 400) {
    const raw = (await res.json().catch(() => null)) as
      | { code?: string; invalidIds?: unknown }
      | null;
    if (raw?.code === 'not_in_org_pool') {
      const ids = Array.isArray(raw.invalidIds)
        ? (raw.invalidIds.filter((x) => typeof x === 'string') as string[])
        : [];
      throw new WsTemplatesNotInPoolError(ids);
    }
    throw new ApiError(400, 'HTTP 400', raw);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, `HTTP ${res.status}`, body);
  }
  const json = (await res.json()) as unknown;
  const parsed = WsTemplatesResponse.safeParse(json);
  if (!parsed.success) {
    throw new ParseError('Response did not match schema', parsed.error.issues);
  }
  return { data: parsed.data, etag: res.headers.get('ETag') };
}
