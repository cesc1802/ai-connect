import { createHttpClient } from "./http-client";
import { getToken } from "./auth-token";

// Configured app singleton. Transport stays React-agnostic: the 401 handler
// is a mutable module-level callback that AuthProvider registers at mount
// (via setOnUnauthorized) so the client can clear-token + redirect without
// importing React/router.

let onUnauthorizedHandler: () => void = () => {};

export function setOnUnauthorized(fn: () => void): void {
  onUnauthorizedHandler = fn;
}

export const api = createHttpClient({
  baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
  getToken,
  onUnauthorized: () => onUnauthorizedHandler(),
});
