import {
  workspaces,
  users,
  userWorkspaces,
  userRoleWorkspaces,
  type DbClient,
} from "@ai-connect/db";
import type { UserRecord } from "./user-repository.js";
import {
  DEV_WORKSPACE_ID,
  DEV_WORKSPACE_SLUG,
  DEV_WORKSPACE_NAME,
  DEV_USER_ID,
  DEV_USERNAME,
} from "./dev-seed-constants.js";

export function seedUsers(seed: UserRecord[]): Map<string, UserRecord> {
  const map = new Map<string, UserRecord>();
  for (const user of seed) {
    map.set(user.username, user);
  }
  return map;
}

/**
 * Seeds the local dev identity (workspace + user + memberships) so the dev-auth
 * bypass and active-workspace resolver have FK-valid rows to reference. Idempotent.
 */
export async function seedDrizzleDevData(client: DbClient): Promise<void> {
  await client.db.transaction(async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: DEV_WORKSPACE_ID, slug: DEV_WORKSPACE_SLUG, name: DEV_WORKSPACE_NAME })
      .onConflictDoNothing();
    await tx
      .insert(users)
      .values({
        id: DEV_USER_ID,
        username: DEV_USERNAME,
        passwordHash: "dev-seed-no-login",
        role: "admin",
      })
      .onConflictDoNothing();
    await tx
      .insert(userWorkspaces)
      .values({ userId: DEV_USER_ID, workspaceId: DEV_WORKSPACE_ID })
      .onConflictDoNothing();
    await tx
      .insert(userRoleWorkspaces)
      .values({ userId: DEV_USER_ID, workspaceId: DEV_WORKSPACE_ID, role: "owner" })
      .onConflictDoNothing();
  });
}
