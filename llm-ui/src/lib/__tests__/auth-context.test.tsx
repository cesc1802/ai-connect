/* @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the transport singleton so the provider never hits the network and we
// can capture the onUnauthorized handler it registers.
vi.mock("../api", () => ({
  api: { post: vi.fn() },
  setOnUnauthorized: vi.fn(),
}));

import { api, setOnUnauthorized } from "../api";
import { AuthProvider, useAuth } from "../auth-context";
import { ApiError } from "../api-error";

const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>;
const mockedSetOnUnauthorized = setOnUnauthorized as unknown as ReturnType<typeof vi.fn>;

// Probe reaches into the live context value + router location for assertions.
let auth: ReturnType<typeof useAuth> | null = null;
let location = "";

function Probe() {
  auth = useAuth();
  location = useLocation().pathname;
  return null;
}

let container: HTMLDivElement;
let root: Root;

function render(initialEntries: string[] = ["/"]) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>,
    );
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // Neutralize any dev VITE_DEV_JWT from the local env so token state starts
  // solely from localStorage — keeps these assertions deterministic.
  vi.stubEnv("VITE_DEV_JWT", "");
});

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  auth = null;
  location = "";
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("AuthProvider / useAuth", () => {
  it("stores the token and flips isAuthenticated on successful login", async () => {
    mockedPost.mockResolvedValue({ token: "jwt-abc", expiresIn: "24h" });
    render();

    expect(auth!.isAuthenticated).toBe(false);
    await act(async () => {
      await auth!.login("demo", "pw");
    });

    expect(auth!.isAuthenticated).toBe(true);
    expect(auth!.token).toBe("jwt-abc");
    expect(localStorage.getItem("auth_token")).toBe("jwt-abc");
  });

  it("surfaces an ApiError on failed login", async () => {
    mockedPost.mockRejectedValue(
      new ApiError(401, "invalid_credentials", "Bad username/password"),
    );
    render(["/login"]);

    await act(async () => {
      await auth!.login("demo", "bad").catch(() => {});
    });

    expect(auth!.error).toBeInstanceOf(ApiError);
    expect(auth!.error?.code).toBe("invalid_credentials");
    expect(auth!.isAuthenticated).toBe(false);
  });

  it("clears the token and redirects to /login when the 401 handler fires", () => {
    localStorage.setItem("auth_token", "seeded");
    render(["/"]);
    expect(auth!.isAuthenticated).toBe(true);

    const handler = mockedSetOnUnauthorized.mock.calls.at(-1)?.[0] as () => void;
    act(() => {
      handler();
    });

    expect(auth!.isAuthenticated).toBe(false);
    expect(location).toBe("/login");
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("throws when useAuth is used outside AuthProvider", () => {
    const orphan = document.createElement("div");
    const orphanRoot = createRoot(orphan);
    expect(() => {
      act(() => {
        orphanRoot.render(<Probe />);
      });
    }).toThrow(/AuthProvider/);
    act(() => orphanRoot.unmount());
  });
});
