import { randomUUID } from "node:crypto";

export type OrgUserStatus = "active" | "pending" | "disabled";

export interface OrgUserRow {
  id: string;
  email: string;
  status: OrgUserStatus;
  joinedAt: string;
}

export interface OrgUsersRepository {
  listByOrg(orgId: string): Promise<OrgUserRow[]>;
  findByEmail(orgId: string, email: string): Promise<OrgUserRow | undefined>;
  findById(orgId: string, id: string): Promise<OrgUserRow | undefined>;
  create(orgId: string, input: Omit<OrgUserRow, "id">): Promise<OrgUserRow>;
  setStatus(
    orgId: string,
    id: string,
    status: OrgUserStatus,
  ): Promise<OrgUserRow | undefined>;
}

export class InMemoryOrgUsersRepository implements OrgUsersRepository {
  private byOrg = new Map<string, Map<string, OrgUserRow>>();

  constructor(seed?: Map<string, OrgUserRow[]>) {
    if (seed) {
      for (const [orgId, rows] of seed) {
        const inner = new Map<string, OrgUserRow>();
        for (const row of rows) inner.set(row.id, { ...row });
        this.byOrg.set(orgId, inner);
      }
    }
  }

  async listByOrg(orgId: string): Promise<OrgUserRow[]> {
    const inner = this.byOrg.get(orgId);
    if (!inner) return [];
    return [...inner.values()].sort((a, b) =>
      a.joinedAt.localeCompare(b.joinedAt),
    );
  }

  async findByEmail(
    orgId: string,
    email: string,
  ): Promise<OrgUserRow | undefined> {
    const inner = this.byOrg.get(orgId);
    if (!inner) return undefined;
    const lower = email.toLowerCase();
    for (const row of inner.values()) {
      if (row.email.toLowerCase() === lower) return row;
    }
    return undefined;
  }

  async findById(
    orgId: string,
    id: string,
  ): Promise<OrgUserRow | undefined> {
    return this.byOrg.get(orgId)?.get(id);
  }

  async create(
    orgId: string,
    input: Omit<OrgUserRow, "id">,
  ): Promise<OrgUserRow> {
    const row: OrgUserRow = { id: randomUUID(), ...input };
    const inner = this.byOrg.get(orgId) ?? new Map<string, OrgUserRow>();
    inner.set(row.id, row);
    this.byOrg.set(orgId, inner);
    return row;
  }

  async setStatus(
    orgId: string,
    id: string,
    status: OrgUserStatus,
  ): Promise<OrgUserRow | undefined> {
    const row = this.byOrg.get(orgId)?.get(id);
    if (!row) return undefined;
    row.status = status;
    return row;
  }
}
