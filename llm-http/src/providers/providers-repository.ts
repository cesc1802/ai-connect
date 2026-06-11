import type { ProviderKind } from "./provider-kind.js";

export type ProviderScope = "org" | "select";

export interface StoredProvider {
  id: string;
  orgId: string;
  displayName: string;
  providerKind: ProviderKind;
  isEnabled: boolean;
  encryptedKey: string;
  lastFour: string;
  baseUrl: string | null;
  defaultModel: string | null;
  scope: ProviderScope;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderInput {
  orgId: string;
  displayName: string;
  providerKind: ProviderKind;
  encryptedKey: string;
  lastFour: string;
  baseUrl?: string | undefined;
  defaultModel?: string | undefined;
  scope?: ProviderScope | undefined;
}

export interface UpdateProviderPatch {
  displayName?: string | undefined;
  isEnabled?: boolean | undefined;
  encryptedKey?: string | undefined;
  lastFour?: string | undefined;
  baseUrl?: string | undefined;
  defaultModel?: string | undefined;
  scope?: ProviderScope | undefined;
}

export interface ProviderCatalogEntry {
  name: string;
  host: string;
  models: string[];
}

export interface ProvidersRepository {
  listByOrg(orgId: string): Promise<StoredProvider[]>;
  findById(orgId: string, id: string): Promise<StoredProvider | null>;
  findByOrgAndName(orgId: string, displayName: string): Promise<StoredProvider | null>;
  create(input: CreateProviderInput): Promise<StoredProvider>;
  update(orgId: string, id: string, patch: UpdateProviderPatch): Promise<StoredProvider>;
  delete(orgId: string, id: string): Promise<void>;
  listCatalog(): Promise<ProviderCatalogEntry[]>;
}
