import { describe, it, expect, vi } from "vitest";
import { checkConnection, type CheckTarget } from "./connection-checker.js";

const KEY = "sk-test-secret-key-0000";

function okFetch(status = 200) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status });
}

async function probe(target: CheckTarget, fetchImpl = okFetch()) {
  const result = await checkConnection(target, fetchImpl as unknown as typeof fetch);
  const call = fetchImpl.mock.calls[0] as
    | [string, { headers: Record<string, string> }]
    | undefined;
  return { result, url: call?.[0], headers: call?.[1]?.headers };
}

describe("checkConnection — per-kind probe shape", () => {
  it("openai: GET {base}/v1/models with Bearer auth", async () => {
    const { result, url, headers } = await probe({ providerKind: "openai", apiKey: KEY });
    expect(url).toBe("https://api.openai.com/v1/models");
    expect(headers?.authorization).toBe(`Bearer ${KEY}`);
    expect(result).toMatchObject({ ok: true });
    expect((result as { latencyMs: number }).latencyMs).toBeTypeOf("number");
  });

  it("minimax: GET {base}/v1/models with Bearer auth", async () => {
    const { url, headers } = await probe({ providerKind: "minimax", apiKey: KEY });
    expect(url).toBe("https://api.minimax.io/v1/models");
    expect(headers?.authorization).toBe(`Bearer ${KEY}`);
  });

  it("anthropic: x-api-key + anthropic-version headers", async () => {
    const { url, headers } = await probe({ providerKind: "anthropic", apiKey: KEY });
    expect(url).toBe("https://api.anthropic.com/v1/models");
    expect(headers?.["x-api-key"]).toBe(KEY);
    expect(headers?.["anthropic-version"]).toBe("2023-06-01");
  });

  it("google: key travels in x-goog-api-key header, never in the URL", async () => {
    const { url, headers } = await probe({ providerKind: "google", apiKey: KEY });
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models");
    expect(headers?.["x-goog-api-key"]).toBe(KEY);
    expect(url).not.toContain(KEY);
  });

  it("ollama: GET {baseUrl}/api/tags without auth headers", async () => {
    const { url, headers } = await probe({
      providerKind: "ollama",
      baseUrl: "http://localhost:11434",
    });
    expect(url).toBe("http://localhost:11434/api/tags");
    expect(headers).toEqual({});
  });

  it("honors a custom baseUrl override for hosted kinds", async () => {
    const { url } = await probe({
      providerKind: "openai",
      apiKey: KEY,
      baseUrl: "https://proxy.example.com/",
    });
    expect(url).toBe("https://proxy.example.com/v1/models");
  });
});

describe("checkConnection — reachability-only kinds", () => {
  it("azure-openai: any HTTP response counts as reachable", async () => {
    const fetchImpl = okFetch(404);
    const { result, url } = await probe(
      { providerKind: "azure-openai", baseUrl: "https://my.azure.example" },
      fetchImpl,
    );
    expect(url).toBe("https://my.azure.example");
    expect(result.ok).toBe(true);
  });

  it("custom: requires baseUrl", async () => {
    const fetchImpl = okFetch();
    const result = await checkConnection(
      { providerKind: "custom" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toMatchObject({ ok: false });
    expect((result as { reason: string }).reason).toContain("baseUrl is required");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("checkConnection — validation and failures", () => {
  it("ollama without baseUrl fails without fetching", async () => {
    const fetchImpl = okFetch();
    const result = await checkConnection(
      { providerKind: "ollama" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("keyed kind without apiKey fails without fetching", async () => {
    const fetchImpl = okFetch();
    const result = await checkConnection(
      { providerKind: "anthropic" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toMatchObject({ ok: false });
    expect((result as { reason: string }).reason).toContain("apiKey is required");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("401 maps to an auth-failure reason that never echoes the key", async () => {
    const { result } = await probe({ providerKind: "openai", apiKey: KEY }, okFetch(401));
    expect(result.ok).toBe(false);
    const reason = (result as { reason: string }).reason;
    expect(reason).toContain("Authentication failed (HTTP 401)");
    expect(reason).not.toContain(KEY);
  });

  it("404 maps to an endpoint-not-found reason", async () => {
    const { result } = await probe({ providerKind: "openai", apiKey: KEY }, okFetch(404));
    expect((result as { reason: string }).reason).toContain("HTTP 404");
  });

  it("timeout abort maps to a timed-out reason", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new DOMException("aborted", "TimeoutError"));
    const result = await checkConnection(
      { providerKind: "openai", apiKey: KEY },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toMatchObject({ ok: false });
    expect((result as { reason: string }).reason).toContain("timed out");
  });

  it("network error maps to an unreachable reason without throwing", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const result = await checkConnection(
      { providerKind: "custom", baseUrl: "http://10.255.255.1" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toEqual({ ok: false, reason: "Network error — endpoint unreachable" });
  });
});
