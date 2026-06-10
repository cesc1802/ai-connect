// Token storage primitive over localStorage["auth_token"]. The live token
// state is owned by AuthProvider (auth-context.tsx); this module is the
// persistence + read seam shared by the HTTP client and the WS client.
//
// Read priority: VITE_DEV_JWT env (dev override) → localStorage. Keeping the
// env fallback lets the existing WS dev flow resolve a token without a login.

const STORAGE_KEY = "auth_token";

export function getToken(): string | null {
  const env = (import.meta.env.VITE_DEV_JWT as string | undefined)?.trim();
  if (env) return env;
  try {
    const ls = window.localStorage.getItem(STORAGE_KEY)?.trim();
    if (ls) return ls;
  } catch {
    // SSR / disabled storage — no-op.
  }
  return null;
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // SSR / disabled storage — no-op.
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // SSR / disabled storage — no-op.
  }
}

export function getWsUrl(): string {
  const base =
    (import.meta.env.VITE_WS_URL as string | undefined)?.trim() ||
    "ws://localhost:3000";
  return `${base.replace(/\/$/, "")}/ws/chat/v2`;
}
