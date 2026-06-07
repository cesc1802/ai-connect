// Minimal dev-only JWT resolver used by Phase 5 to bootstrap the WS
// client. Phase 3 will replace this with a full AuthContext + paste-in
// banner. Source priority: VITE_DEV_JWT env, then localStorage["dev_jwt"].

const STORAGE_KEY = "dev_jwt";

export function getDevToken(): string | null {
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

export function getWsUrl(): string {
  const base =
    (import.meta.env.VITE_WS_URL as string | undefined)?.trim() ||
    "ws://localhost:3000";
  return `${base.replace(/\/$/, "")}/ws/chat/v2`;
}
