import type { ProviderKind } from "./provider-kind.js";

export interface CheckTarget {
  providerKind: ProviderKind;
  baseUrl?: string | null | undefined;
  apiKey?: string | undefined;
}

export type CheckResult =
  | { ok: true; latencyMs: number }
  | { ok: false; reason: string };

export type ConnectionChecker = (target: CheckTarget) => Promise<CheckResult>;

const CHECK_TIMEOUT_MS = 5_000;

// Hosted kinds fall back to their public API host when no baseUrl is given.
const DEFAULT_BASE_URLS: Partial<Record<ProviderKind, string>> = {
  openai: "https://api.openai.com",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com",
  minimax: "https://api.minimax.io",
};

// Self-addressed kinds have no public host; baseUrl is mandatory.
const BASE_URL_REQUIRED = new Set<ProviderKind>(["ollama", "azure-openai", "custom"]);

// Kinds checked via a cheap authenticated endpoint (vs bare reachability).
const KEYED_KINDS = new Set<ProviderKind>(["openai", "anthropic", "google", "minimax"]);

interface ProbeRequest {
  url: string;
  headers: Record<string, string>;
  /** When true any HTTP response counts as success (reachability-only probe). */
  reachabilityOnly: boolean;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

/**
 * Build the cheapest request that proves the credentials/endpoint work.
 * The API key travels only in headers — never in the URL — so failure
 * reasons and error messages can be surfaced without leaking key material.
 */
function buildProbe(target: CheckTarget): ProbeRequest | { reason: string } {
  const { providerKind: kind } = target;
  const base = target.baseUrl || DEFAULT_BASE_URLS[kind];
  if (!base) {
    return { reason: `baseUrl is required to check a ${kind} provider` };
  }
  if (BASE_URL_REQUIRED.has(kind) && !target.baseUrl) {
    return { reason: `baseUrl is required to check a ${kind} provider` };
  }
  if (KEYED_KINDS.has(kind) && !target.apiKey) {
    return { reason: `apiKey is required to check a ${kind} provider` };
  }

  switch (kind) {
    case "openai":
    case "minimax":
      return {
        url: joinUrl(base, "/v1/models"),
        headers: { authorization: `Bearer ${target.apiKey}` },
        reachabilityOnly: false,
      };
    case "anthropic":
      return {
        url: joinUrl(base, "/v1/models"),
        headers: { "x-api-key": target.apiKey!, "anthropic-version": "2023-06-01" },
        reachabilityOnly: false,
      };
    case "google":
      return {
        url: joinUrl(base, "/v1beta/models"),
        headers: { "x-goog-api-key": target.apiKey! },
        reachabilityOnly: false,
      };
    case "ollama":
      return { url: joinUrl(base, "/api/tags"), headers: {}, reachabilityOnly: false };
    case "azure-openai":
    case "custom":
      // No universal authenticated endpoint for these kinds; any HTTP
      // response proves the endpoint is reachable.
      return { url: base, headers: {}, reachabilityOnly: true };
  }
}

function reasonForStatus(status: number): string {
  if (status === 401 || status === 403) {
    return `Authentication failed (HTTP ${status}) — check the API key`;
  }
  if (status === 404) return "Endpoint not found (HTTP 404) — check the base URL";
  return `Provider responded with HTTP ${status}`;
}

/**
 * Ping a provider with a real HTTP request and a hard timeout. Returns a
 * structured result; never throws and never includes key material in
 * `reason` (keys are header-only, see buildProbe).
 */
export async function checkConnection(
  target: CheckTarget,
  fetchImpl: typeof fetch = fetch,
): Promise<CheckResult> {
  const probe = buildProbe(target);
  if ("reason" in probe) return { ok: false, reason: probe.reason };

  const startedAt = performance.now();
  try {
    const response = await fetchImpl(probe.url, {
      method: "GET",
      headers: probe.headers,
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    if (response.ok || probe.reachabilityOnly) return { ok: true, latencyMs };
    return { ok: false, reason: reasonForStatus(response.status) };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return { ok: false, reason: `Connection timed out after ${CHECK_TIMEOUT_MS}ms` };
    }
    return { ok: false, reason: "Network error — endpoint unreachable" };
  }
}
