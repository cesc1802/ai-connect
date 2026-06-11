/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearToken, getToken, setToken } from "../auth-token";

const STORAGE_KEY = "auth_token";

afterEach(() => {
  vi.unstubAllEnvs();
  window.localStorage.clear();
});

describe("getToken read priority", () => {
  it("prefers the localStorage login token over VITE_DEV_JWT", () => {
    // A stale dev env token must never shadow a real logged-in session,
    // otherwise every authenticated request 401s after login.
    vi.stubEnv("VITE_DEV_JWT", "stale-dev-token");
    window.localStorage.setItem(STORAGE_KEY, "fresh-login-token");

    expect(getToken()).toBe("fresh-login-token");
  });

  it("falls back to VITE_DEV_JWT when no login token is stored", () => {
    vi.stubEnv("VITE_DEV_JWT", "dev-token");

    expect(getToken()).toBe("dev-token");
  });

  it("returns null when neither source has a token", () => {
    vi.stubEnv("VITE_DEV_JWT", "");

    expect(getToken()).toBeNull();
  });

  it("ignores whitespace-only localStorage values and uses the env fallback", () => {
    vi.stubEnv("VITE_DEV_JWT", "dev-token");
    window.localStorage.setItem(STORAGE_KEY, "   ");

    expect(getToken()).toBe("dev-token");
  });
});

describe("setToken / clearToken", () => {
  it("round-trips through localStorage", () => {
    vi.stubEnv("VITE_DEV_JWT", "");
    setToken("abc");
    expect(getToken()).toBe("abc");
    clearToken();
    expect(getToken()).toBeNull();
  });
});
