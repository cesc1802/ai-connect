import { useAuthStore } from '@/stores/auth-store';
import { API_BASE_URL } from './client';
import { ApiError, NetworkError, ParseError } from './errors';
import {
  QuotasListResponse,
  QuotasPatchResponse,
  type PatchQuotasRequest,
} from '@/schemas/admin';

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

export async function getWsQuotas(): Promise<QuotasListResponse> {
  const res = await rawFetch('/admin/workspace/quotas', {
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, `HTTP ${res.status}`, body);
  }
  const json = (await res.json()) as unknown;
  const parsed = QuotasListResponse.safeParse(json);
  if (!parsed.success) {
    throw new ParseError('Response did not match schema', parsed.error.issues);
  }
  return parsed.data;
}

export async function patchWsQuotas(
  body: PatchQuotasRequest,
): Promise<QuotasPatchResponse> {
  const res = await rawFetch('/admin/workspace/quotas', {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(authHeaders() as Record<string, string>),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new ApiError(res.status, `HTTP ${res.status}`, errBody);
  }
  const json = (await res.json()) as unknown;
  const parsed = QuotasPatchResponse.safeParse(json);
  if (!parsed.success) {
    throw new ParseError('Response did not match schema', parsed.error.issues);
  }
  return parsed.data;
}
