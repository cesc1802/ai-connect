import { randomUUID } from "node:crypto";
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

export class InMemoryProvidersRepository implements ProvidersRepository {
  private readonly rows = new Map<string, StoredProvider>();
  /** Seedable catalog rows for tests; empty by default. */
  readonly catalog: ProviderCatalogEntry[] = [];

  async listByOrg(orgId: string): Promise<StoredProvider[]> {
    return [...this.rows.values()]
      .filter((r) => r.orgId === orgId)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async findById(orgId: string, id: string): Promise<StoredProvider | null> {
    const row = this.rows.get(id);
    if (!row || row.orgId !== orgId) return null;
    return row;
  }

  async findByOrgAndName(
    orgId: string,
    displayName: string,
  ): Promise<StoredProvider | null> {
    const normalized = displayName.trim().toLowerCase();
    for (const row of this.rows.values()) {
      if (
        row.orgId === orgId &&
        row.displayName.trim().toLowerCase() === normalized
      ) {
        return row;
      }
    }
    return null;
  }

  async create(input: CreateProviderInput): Promise<StoredProvider> {
    const now = new Date().toISOString();
    const row: StoredProvider = {
      id: randomUUID(),
      orgId: input.orgId,
      displayName: input.displayName,
      providerKind: input.providerKind,
      isEnabled: true,
      encryptedKey: input.encryptedKey,
      lastFour: input.lastFour,
      baseUrl: input.baseUrl ?? null,
      defaultModel: input.defaultModel ?? null,
      scope: input.scope ?? "org",
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async update(
    orgId: string,
    id: string,
    patch: UpdateProviderPatch,
  ): Promise<StoredProvider> {
    const existing = await this.findById(orgId, id);
    if (!existing) throw new Error(`provider ${id} not found`);
    const updated: StoredProvider = {
      ...existing,
      ...(patch.displayName !== undefined && { displayName: patch.displayName }),
      ...(patch.isEnabled !== undefined && { isEnabled: patch.isEnabled }),
      ...(patch.encryptedKey !== undefined && {
        encryptedKey: patch.encryptedKey,
      }),
      ...(patch.lastFour !== undefined && { lastFour: patch.lastFour }),
      ...(patch.baseUrl !== undefined && { baseUrl: patch.baseUrl }),
      ...(patch.defaultModel !== undefined && { defaultModel: patch.defaultModel }),
      ...(patch.scope !== undefined && { scope: patch.scope }),
      updatedAt: new Date().toISOString(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async delete(orgId: string, id: string): Promise<void> {
    const existing = await this.findById(orgId, id);
    if (!existing) throw new Error(`provider ${id} not found`);
    this.rows.delete(id);
  }

  async listCatalog(): Promise<ProviderCatalogEntry[]> {
    return [...this.catalog];
  }
}
