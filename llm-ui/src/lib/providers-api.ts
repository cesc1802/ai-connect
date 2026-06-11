import { api } from "./api";

// Thin typed wrappers over the org-admin `/providers` resource. All routes
// are org-admin only server-side (403 role_required for members). The full
// API key is sent only on create/rotate/check and never comes back: list
// responses carry `lastFour` + `hasKey` only.

export type ProviderKind =
  | "openai"
  | "anthropic"
  | "google"
  | "azure-openai"
  | "ollama"
  | "minimax"
  | "custom";

export type WireProviderScope = "org" | "select";

export interface WireProvider {
  id: string;
  displayName: string;
  providerKind: ProviderKind;
  isEnabled: boolean;
  hasKey: boolean;
  lastFour: string;
  baseUrl: string | null;
  defaultModel: string | null;
  scope: WireProviderScope;
}

export interface ProviderCreateBody {
  displayName: string;
  providerKind: ProviderKind;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  scope?: WireProviderScope;
}

export interface ProviderUpdateBody {
  displayName?: string;
  isEnabled?: boolean;
  baseUrl?: string;
  defaultModel?: string;
  scope?: WireProviderScope;
}

export interface CheckConnectionBody {
  providerId?: string;
  providerKind?: ProviderKind;
  baseUrl?: string;
  apiKey?: string;
}

export type CheckResult =
  | { ok: true; latencyMs: number }
  | { ok: false; reason: string };

export interface CatalogEntry {
  name: string;
  host: string;
  models: string[];
}

export function listProviders(): Promise<WireProvider[]> {
  return api.get<{ providers: WireProvider[] }>("/providers").then((r) => r.providers);
}

export function createProvider(body: ProviderCreateBody): Promise<WireProvider> {
  return api.post<{ provider: WireProvider }>("/providers", body).then((r) => r.provider);
}

export function updateProvider(id: string, body: ProviderUpdateBody): Promise<WireProvider> {
  return api
    .patch<{ provider: WireProvider }>(`/providers/${encodeURIComponent(id)}`, body)
    .then((r) => r.provider);
}

export function rotateProviderKey(id: string, apiKey: string): Promise<WireProvider> {
  return api
    .post<{ provider: WireProvider }>(`/providers/${encodeURIComponent(id)}/rotate-key`, { apiKey })
    .then((r) => r.provider);
}

export function deleteProvider(id: string): Promise<void> {
  return api.del<void>(`/providers/${encodeURIComponent(id)}`);
}

export function checkProviderConnection(body: CheckConnectionBody): Promise<CheckResult> {
  return api.post<CheckResult>("/providers/check", body);
}

export function getProviderCatalog(): Promise<CatalogEntry[]> {
  return api.get<{ catalog: CatalogEntry[] }>("/providers/catalog").then((r) => r.catalog);
}
