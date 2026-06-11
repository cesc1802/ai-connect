import { asc, eq, inArray } from "drizzle-orm";
import { users, userWorkspaces, type DbClient } from "@ai-connect/db";
import type { SystemRole } from "@ai-connect/shared";

/** Minimal user projection exposed by GET /users. */
export interface BasicUser {
  id: string;
  username: string;
  role: SystemRole;
}

export interface UsersRepository {
  listAll(): Promise<BasicUser[]>;
  /** Users sharing at least one workspace with the caller, caller always included. */
  listCoWorkspaceUsers(callerId: string): Promise<BasicUser[]>;
}

export class DrizzleUsersRepository implements UsersRepository {
  constructor(private readonly client: DbClient) {}

  async listAll(): Promise<BasicUser[]> {
    const rows = await this.client.db
      .select({ id: users.id, username: users.username, role: users.role })
      .from(users)
      .orderBy(asc(users.username));
    return rows.map(toBasicUser);
  }

  async listCoWorkspaceUsers(callerId: string): Promise<BasicUser[]> {
    const callerMemberships = await this.client.db
      .select({ workspaceId: userWorkspaces.workspaceId })
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, callerId));
    const workspaceIds = callerMemberships.map((r) => r.workspaceId);

    let rows: Array<{ id: string; username: string; role: string }> = [];
    if (workspaceIds.length > 0) {
      rows = await this.client.db
        .selectDistinct({
          id: users.id,
          username: users.username,
          role: users.role,
        })
        .from(users)
        .innerJoin(userWorkspaces, eq(users.id, userWorkspaces.userId))
        .where(inArray(userWorkspaces.workspaceId, workspaceIds))
        .orderBy(asc(users.username));
    }

    // A caller with no workspace memberships still sees themselves.
    if (!rows.some((r) => r.id === callerId)) {
      const [self] = await this.client.db
        .select({ id: users.id, username: users.username, role: users.role })
        .from(users)
        .where(eq(users.id, callerId))
        .limit(1);
      if (self) rows.unshift(self);
    }

    return rows.map(toBasicUser);
  }
}

function toBasicUser(row: {
  id: string;
  username: string;
  role: string;
}): BasicUser {
  return {
    id: row.id,
    username: row.username,
    // Column is plain text; the app constrains values to SystemRole on write.
    role: row.role as SystemRole,
  };
}

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
