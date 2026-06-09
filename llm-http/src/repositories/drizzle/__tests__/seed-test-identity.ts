import {
  workspaces,
  users,
  userWorkspaces,
  type DbClient,
} from "@ai-connect/db";

/**
 * Seeds an FK-valid workspace + user + membership for a Drizzle repo test.
 * Each test file uses its OWN identity so parallel cleanup (delete-by-userId)
 * in one file never wipes rows another file is mid-test on. Idempotent.
 */
export async function seedTestIdentity(
  client: DbClient,
  ids: { workspaceId: string; userId: string; slug: string }
): Promise<void> {
  await client.db.transaction(async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: ids.workspaceId, slug: ids.slug, name: ids.slug })
      .onConflictDoNothing();
    await tx
      .insert(users)
      .values({
        id: ids.userId,
        username: ids.userId,
        passwordHash: "test-no-login",
        role: "member",
      })
      .onConflictDoNothing();
    await tx
      .insert(userWorkspaces)
      .values({ userId: ids.userId, workspaceId: ids.workspaceId })
      .onConflictDoNothing();
  });
}
