import type { WorkspaceRole } from "@ai-connect/shared";

export interface StoredRoleQuota {
  role: WorkspaceRole;
  maxRequests: number;
}

export interface WsQuotasRepo {
  get(orgId: string, workspaceId: string): Promise<StoredRoleQuota[]>;
  set(
    orgId: string,
    workspaceId: string,
    rows: StoredRoleQuota[],
  ): Promise<void>;
}

const DEFAULT_QUOTAS: StoredRoleQuota[] = [
  { role: "owner", maxRequests: 1000 },
  { role: "admin", maxRequests: 500 },
  { role: "member", maxRequests: 200 },
  { role: "viewer", maxRequests: 50 },
];

export class InMemoryWsQuotasRepo implements WsQuotasRepo {
  private readonly byKey = new Map<string, StoredRoleQuota[]>();

  private static key(orgId: string, workspaceId: string): string {
    return `${orgId}::${workspaceId}`;
  }

  async get(
    orgId: string,
    workspaceId: string,
  ): Promise<StoredRoleQuota[]> {
    const key = InMemoryWsQuotasRepo.key(orgId, workspaceId);
    const stored = this.byKey.get(key);
    if (!stored) {
      return DEFAULT_QUOTAS.map((r) => ({ ...r }));
    }
    return stored.map((r) => ({ ...r }));
  }

  async set(
    orgId: string,
    workspaceId: string,
    rows: StoredRoleQuota[],
  ): Promise<void> {
    const key = InMemoryWsQuotasRepo.key(orgId, workspaceId);
    this.byKey.set(key, rows.map((r) => ({ ...r })));
  }
}
