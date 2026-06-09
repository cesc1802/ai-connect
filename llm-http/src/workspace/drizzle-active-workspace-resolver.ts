import { eq, and, isNull, asc } from "drizzle-orm";
import { workspaces, userWorkspaces, type DbClient } from "@ai-connect/db";
import type {
  ActiveWorkspace,
  ActiveWorkspaceResolver,
} from "./active-workspace-resolver.js";

/** Resolves the user's oldest non-deleted workspace as their active one. */
export class DrizzleActiveWorkspaceResolver implements ActiveWorkspaceResolver {
  constructor(private readonly client: DbClient) {}

  async getForUser(userId: string): Promise<ActiveWorkspace | null> {
    const rows = await this.client.db
      .select({
        id: workspaces.id,
        slug: workspaces.slug,
        name: workspaces.name,
      })
      .from(userWorkspaces)
      .innerJoin(workspaces, eq(userWorkspaces.workspaceId, workspaces.id))
      .where(and(eq(userWorkspaces.userId, userId), isNull(workspaces.deletedAt)))
      .orderBy(asc(workspaces.createdAt))
      .limit(1);

    return rows[0] ?? null;
  }
}
