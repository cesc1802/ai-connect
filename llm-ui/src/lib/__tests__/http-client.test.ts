import { describe, expect, it, vi } from "vitest";
import { createHttpClient } from "../http-client";
import { ApiError } from "../api-error";

// Captures the (url, init) passed to fetch and returns a scripted Response.
function stubFetch(response: Response) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return response;
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

const BASE = "http://api.test";

describe("createHttpClient", () => {
  it("prepends baseUrl and attaches a Bearer header when a token exists", async () => {
    const { fetchFn, calls } = stubFetch(new Response("{}", { status: 200 }));
    const client = createHttpClient({ baseUrl: BASE, getToken: () => "tok123", fetchFn });

    await client.get("/auth/me");

    expect(calls[0].url).toBe("http://api.test/auth/me");
    const headers = new Headers(calls[0].init.headers);
    expect(headers.get("Authorization")).toBe("Bearer tok123");
  });

  it("omits the Bearer header when getToken returns null", async () => {
    const { fetchFn, calls } = stubFetch(new Response("{}", { status: 200 }));
    const client = createHttpClient({ baseUrl: BASE, getToken: () => null, fetchFn });

    await client.get("/public");

    const headers = new Headers(calls[0].init.headers);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("serializes the body and sets JSON content-type on POST", async () => {
    const { fetchFn, calls } = stubFetch(new Response("{}", { status: 200 }));
    const client = createHttpClient({ baseUrl: BASE, getToken: () => null, fetchFn });

    await client.post("/auth/login", { username: "demo", password: "pw" });

    const headers = new Headers(calls[0].init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(calls[0].init.body).toBe('{"username":"demo","password":"pw"}');
    expect(calls[0].init.method).toBe("POST");
  });

  it("throws ApiError carrying status/code/message on a non-2xx response", async () => {
    const body = JSON.stringify({ code: "invalid_body", message: "Username is required" });
    const { fetchFn } = stubFetch(new Response(body, { status: 400 }));
    const client = createHttpClient({ baseUrl: BASE, getToken: () => null, fetchFn });

    await expect(client.post("/auth/login", {})).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      code: "invalid_body",
      message: "Username is required",
    });
  });

  it("invokes onUnauthorized exactly once before throwing on 401", async () => {
    const body = JSON.stringify({ code: "invalid_token", message: "expired" });
    const { fetchFn } = stubFetch(new Response(body, { status: 401 }));
    const onUnauthorized = vi.fn();
    const client = createHttpClient({ baseUrl: BASE, getToken: () => "t", onUnauthorized, fetchFn });

    await expect(client.get("/admin/users")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("resolves to undefined for a 204 response without a parse crash", async () => {
    const { fetchFn } = stubFetch(new Response(null, { status: 204 }));
    const client = createHttpClient({ baseUrl: BASE, getToken: () => null, fetchFn });

    await expect(client.del("/admin/providers/1")).resolves.toBeUndefined();
  });

  it("resolves to undefined for an empty 200 body", async () => {
    const { fetchFn } = stubFetch(new Response("", { status: 200 }));
    const client = createHttpClient({ baseUrl: BASE, getToken: () => null, fetchFn });

    await expect(client.get("/ping")).resolves.toBeUndefined();
  });
});
