import type { BasicUser, UsersRepository } from "../users-repo.js";

/** Test double; memberships maps userId → workspaceIds. */
export class InMemoryUsersRepository implements UsersRepository {
  constructor(
    private readonly rows: BasicUser[],
    private readonly memberships: Map<string, string[]> = new Map(),
  ) {}

  async listAll(): Promise<BasicUser[]> {
    return [...this.rows];
  }

  async listCoWorkspaceUsers(callerId: string): Promise<BasicUser[]> {
    const callerWs = new Set(this.memberships.get(callerId) ?? []);
    return this.rows.filter((u) => {
      if (u.id === callerId) return true;
      const ws = this.memberships.get(u.id) ?? [];
      return ws.some((w) => callerWs.has(w));
    });
  }
}
