import { randomUUID } from "node:crypto";
import type { WorkspaceRole } from "@ai-connect/shared";

export interface WsMemberRow {
  id: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WsMembersRepository {
  listByWs(wsId: string): Promise<WsMemberRow[]>;
  findById(wsId: string, id: string): Promise<WsMemberRow | undefined>;
  findByEmail(wsId: string, email: string): Promise<WsMemberRow | undefined>;
  countAdmins(wsId: string): Promise<number>;
  create(
    wsId: string,
    input: Omit<WsMemberRow, "id">,
  ): Promise<WsMemberRow>;
  setRole(
    wsId: string,
    id: string,
    role: WorkspaceRole,
  ): Promise<WsMemberRow | undefined>;
  remove(wsId: string, id: string): Promise<WsMemberRow | undefined>;
}

export class InMemoryWsMembersRepository implements WsMembersRepository {
  private byWs = new Map<string, Map<string, WsMemberRow>>();

  constructor(seed?: Map<string, WsMemberRow[]>) {
    if (seed) {
      for (const [wsId, rows] of seed) {
        const inner = new Map<string, WsMemberRow>();
        for (const row of rows) inner.set(row.id, { ...row });
        this.byWs.set(wsId, inner);
      }
    }
  }

  async listByWs(wsId: string): Promise<WsMemberRow[]> {
    const inner = this.byWs.get(wsId);
    if (!inner) return [];
    return [...inner.values()].sort((a, b) =>
      a.joinedAt.localeCompare(b.joinedAt),
    );
  }

  async findById(
    wsId: string,
    id: string,
  ): Promise<WsMemberRow | undefined> {
    return this.byWs.get(wsId)?.get(id);
  }

  async findByEmail(
    wsId: string,
    email: string,
  ): Promise<WsMemberRow | undefined> {
    const inner = this.byWs.get(wsId);
    if (!inner) return undefined;
    const lower = email.toLowerCase();
    for (const row of inner.values()) {
      if (row.email.toLowerCase() === lower) return row;
    }
    return undefined;
  }

  async countAdmins(wsId: string): Promise<number> {
    const inner = this.byWs.get(wsId);
    if (!inner) return 0;
    let n = 0;
    for (const row of inner.values()) {
      if (row.role === "admin") n += 1;
    }
    return n;
  }

  async create(
    wsId: string,
    input: Omit<WsMemberRow, "id">,
  ): Promise<WsMemberRow> {
    const row: WsMemberRow = { id: randomUUID(), ...input };
    const inner = this.byWs.get(wsId) ?? new Map<string, WsMemberRow>();
    inner.set(row.id, row);
    this.byWs.set(wsId, inner);
    return row;
  }

  async setRole(
    wsId: string,
    id: string,
    role: WorkspaceRole,
  ): Promise<WsMemberRow | undefined> {
    const row = this.byWs.get(wsId)?.get(id);
    if (!row) return undefined;
    row.role = role;
    return row;
  }

  async remove(
    wsId: string,
    id: string,
  ): Promise<WsMemberRow | undefined> {
    const inner = this.byWs.get(wsId);
    if (!inner) return undefined;
    const row = inner.get(id);
    if (!row) return undefined;
    inner.delete(id);
    return row;
  }
}
