import { ApiError } from "./api-error";

// Zero-dependency `fetch` wrapper with ordered request/response interceptor
// pipelines. Pure transport — no React imports. Mirrors ws-client.ts house
// style: typed options object + an injectable transport seam (`fetchFn`) so
// tests can drive it without a network.

export interface RequestContext {
  url: string;
  init: RequestInit;
}

// Request interceptors mutate the outgoing URL/headers in array order.
export type RequestInterceptor = (ctx: RequestContext) => RequestContext;
// Response interceptors run in array order; the default one throws ApiError
// on non-2xx, so later interceptors only see successful responses.
export type ResponseInterceptor = (res: Response) => Response | Promise<Response>;

export interface HttpClientOptions {
  baseUrl: string;
  getToken: () => string | null;
  onUnauthorized?: () => void;
  fetchFn?: typeof fetch; // test seam — production callers omit this.
}

export interface HttpClient {
  get: <T>(path: string, init?: RequestInit) => Promise<T>;
  post: <T>(path: string, body?: unknown, init?: RequestInit) => Promise<T>;
  patch: <T>(path: string, body?: unknown, init?: RequestInit) => Promise<T>;
  put: <T>(path: string, body?: unknown, init?: RequestInit) => Promise<T>;
  del: <T>(path: string, init?: RequestInit) => Promise<T>;
  // Exposed so callers can append more interceptors later (e.g. tracing).
  requestInterceptors: RequestInterceptor[];
  responseInterceptors: ResponseInterceptor[];
}

function joinUrl(baseUrl: string, path: string): string {
  // Absolute paths win; otherwise splice on a single slash boundary.
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function createHttpClient(opts: HttpClientOptions): HttpClient {
  const { baseUrl, getToken, onUnauthorized } = opts;
  const fetchFn = opts.fetchFn ?? fetch;

  const defaultRequestInterceptor: RequestInterceptor = (ctx) => {
    const headers = new Headers(ctx.init.headers);
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    // JSON content-type only when we actually send a body and the caller
    // hasn't set one (lets future callers send other content types).
    if (
      ctx.init.body != null &&
      typeof ctx.init.body === "string" &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }
    return { url: joinUrl(baseUrl, ctx.url), init: { ...ctx.init, headers } };
  };

  const defaultResponseInterceptor: ResponseInterceptor = async (res) => {
    if (res.ok) return res;
    // Defensive parse: error bodies may be empty or non-JSON.
    const body = (await res.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
      issues?: unknown[];
    };
    // Fire the 401 hook (clear token + redirect) before surfacing the error,
    // so session-expiry recovery starts regardless of caller handling.
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(
      res.status,
      body.code ?? "unknown",
      body.message ?? res.statusText,
      body.issues,
    );
  };

  const requestInterceptors: RequestInterceptor[] = [defaultRequestInterceptor];
  const responseInterceptors: ResponseInterceptor[] = [defaultResponseInterceptor];

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    init?: RequestInit,
  ): Promise<T> {
    let ctx: RequestContext = { url: path, init: { ...init, method } };
    if (body !== undefined) ctx.init.body = JSON.stringify(body);
    for (const interceptor of requestInterceptors) ctx = interceptor(ctx);

    let res = await fetchFn(ctx.url, ctx.init);
    for (const interceptor of responseInterceptors) res = await interceptor(res);

    // 204 and empty bodies resolve to undefined without a JSON-parse crash.
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    get: <T>(path: string, init?: RequestInit) => request<T>("GET", path, undefined, init),
    post: <T>(path: string, body?: unknown, init?: RequestInit) =>
      request<T>("POST", path, body, init),
    patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
      request<T>("PATCH", path, body, init),
    put: <T>(path: string, body?: unknown, init?: RequestInit) =>
      request<T>("PUT", path, body, init),
    del: <T>(path: string, init?: RequestInit) => request<T>("DELETE", path, undefined, init),
    requestInterceptors,
    responseInterceptors,
  };
}
