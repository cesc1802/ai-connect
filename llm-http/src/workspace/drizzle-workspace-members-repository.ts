import { eq, and, notInArray, inArray, isNull } from "drizzle-orm";
import {
  users,
  userWorkspaces,
  userRoleWorkspaces,
  workspaces,
  type DbClient,
} from "@ai-connect/db";
import {
  MemberExistsError,
  MemberNotFoundError,
  type WsRole,
  type WorkspaceMember,
  type WorkspaceMembership,
  type WorkspaceMembersRepository,
} from "./workspace-members-repository.js";

/** Postgres SQLSTATE for unique_violation. */
const UNIQUE_VIOLATION = "23505";

export class DrizzleWorkspaceMembersRepository
  implements WorkspaceMembersRepository
{
  constructor(private readonly client: DbClient) {}

  async list(workspaceId: string): Promise<WorkspaceMember[]> {
    // Fetch membership rows joined to users (username, org role).
    const memberRows = await this.client.db
      .select({
        userId: userWorkspaces.userId,
        username: users.username,
        orgRole: users.role,
      })
      .from(userWorkspaces)
      .innerJoin(users, eq(userWorkspaces.userId, users.id))
      .where(eq(userWorkspaces.workspaceId, workspaceId));

    if (memberRows.length === 0) return [];

    const memberIds = memberRows.map((r) => r.userId);

    // Fetch all role rows for members of this workspace in one query.
    const roleRows = await this.client.db
      .select({ userId: userRoleWorkspaces.userId, role: userRoleWorkspaces.role })
      .from(userRoleWorkspaces)
      .where(
        and(
          eq(userRoleWorkspaces.workspaceId, workspaceId),
          inArray(userRoleWorkspaces.userId, memberIds)
        )
      );

    // Build userId → wsRoles map.
    const rolesMap = new Map<string, WsRole[]>();
    for (const { userId, role } of roleRows) {
      const arr = rolesMap.get(userId) ?? [];
      arr.push(role as WsRole);
      rolesMap.set(userId, arr);
    }

    return memberRows.map((m) => ({
      userId: m.userId,
      username: m.username,
      orgRole: m.orgRole,
      wsRoles: rolesMap.get(m.userId) ?? [],
    }));
  }

  async listMembershipsForUser(userId: string): Promise<WorkspaceMembership[]> {
    const wsRows = await this.client.db
      .select({
        workspaceId: workspaces.id,
        slug: workspaces.slug,
        name: workspaces.name,
      })
      .from(userWorkspaces)
      .innerJoin(workspaces, eq(userWorkspaces.workspaceId, workspaces.id))
      .where(
        and(eq(userWorkspaces.userId, userId), isNull(workspaces.deletedAt))
      )
      .orderBy(workspaces.name);

    if (wsRows.length === 0) return [];

    const roleRows = await this.client.db
      .select({
        workspaceId: userRoleWorkspaces.workspaceId,
        role: userRoleWorkspaces.role,
      })
      .from(userRoleWorkspaces)
      .where(eq(userRoleWorkspaces.userId, userId));

    const rolesMap = new Map<string, WsRole[]>();
    for (const { workspaceId, role } of roleRows) {
      const arr = rolesMap.get(workspaceId) ?? [];
      arr.push(role as WsRole);
      rolesMap.set(workspaceId, arr);
    }

    return wsRows.map((w) => ({
      ...w,
      roles: rolesMap.get(w.workspaceId) ?? [],
    }));
  }

  async listCandidates(
    workspaceId: string
  ): Promise<Array<{ userId: string; username: string; orgRole: string }>> {
    // Sub-select current member ids to exclude.
    const currentMembers = await this.client.db
      .select({ userId: userWorkspaces.userId })
      .from(userWorkspaces)
      .where(eq(userWorkspaces.workspaceId, workspaceId));

    const excludeIds = currentMembers.map((r) => r.userId);

    const query = this.client.db
      .select({ userId: users.id, username: users.username, orgRole: users.role })
      .from(users);

    if (excludeIds.length === 0) {
      return query;
    }

    return query.where(notInArray(users.id, excludeIds));
  }

  async add(workspaceId: string, userId: string, roles: WsRole[]): Promise<void> {
    await this.client.db.transaction(async (tx) => {
      try {
        await tx.insert(userWorkspaces).values({ userId, workspaceId });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new MemberExistsError(userId, workspaceId);
        }
        throw err;
      }

      if (roles.length > 0) {
        await tx
          .insert(userRoleWorkspaces)
          .values(roles.map((role) => ({ userId, workspaceId, role })));
      }
    });
  }

  async replaceRoles(
    workspaceId: string,
    userId: string,
    roles: WsRole[]
  ): Promise<void> {
    await this.client.db.transaction(async (tx) => {
      // Verify membership exists before replacing roles.
      const [row] = await tx
        .select({ userId: userWorkspaces.userId })
        .from(userWorkspaces)
        .where(
          and(
            eq(userWorkspaces.userId, userId),
            eq(userWorkspaces.workspaceId, workspaceId)
          )
        )
        .limit(1);

      if (!row) {
        throw new MemberNotFoundError(userId, workspaceId);
      }

      await tx
        .delete(userRoleWorkspaces)
        .where(
          and(
            eq(userRoleWorkspaces.userId, userId),
            eq(userRoleWorkspaces.workspaceId, workspaceId)
          )
        );

      if (roles.length > 0) {
        await tx
          .insert(userRoleWorkspaces)
          .values(roles.map((role) => ({ userId, workspaceId, role })));
      }
    });
  }

  async remove(workspaceId: string, userId: string): Promise<boolean> {
    // userRoleWorkspaces has no FK to userWorkspaces (only to users and
    // workspaces), so role rows must be deleted explicitly alongside the
    // membership row.
    return await this.client.db.transaction(async (tx) => {
      const rows = await tx
        .delete(userWorkspaces)
        .where(
          and(
            eq(userWorkspaces.userId, userId),
            eq(userWorkspaces.workspaceId, workspaceId)
          )
        )
        .returning({ userId: userWorkspaces.userId });
      if (rows.length === 0) return false;

      await tx
        .delete(userRoleWorkspaces)
        .where(
          and(
            eq(userRoleWorkspaces.userId, userId),
            eq(userRoleWorkspaces.workspaceId, workspaceId)
          )
        );
      return true;
    });
  }

  async isMember(userId: string, workspaceId: string): Promise<boolean> {
    const [row] = await this.client.db
      .select({ userId: userWorkspaces.userId })
      .from(userWorkspaces)
      .where(
        and(
          eq(userWorkspaces.userId, userId),
          eq(userWorkspaces.workspaceId, workspaceId)
        )
      )
      .limit(1);
    return row !== undefined;
  }

  async userExists(userId: string): Promise<boolean> {
    const [row] = await this.client.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row !== undefined;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === UNIQUE_VIOLATION
  );
}
