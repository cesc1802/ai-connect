import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray, like } from "drizzle-orm";
import {
  createDbClient,
  users,
  workspaces,
  userWorkspaces,
  type DbClient,
} from "@ai-connect/db";
import { DrizzleUsersRepository } from "../users-repo.js";

// Dedicated stable IDs scoped to this test file to avoid races with other files.
const TEST_USER_A = "00000000-0000-0000-ffff-000000000b01";
const TEST_USER_B = "00000000-0000-0000-ffff-000000000b02";
const TEST_USER_C = "00000000-0000-0000-ffff-000000000b03";
const TEST_USER_LONER = "00000000-0000-0000-ffff-000000000b04";
const TEST_USER_IDS = [TEST_USER_A, TEST_USER_B, TEST_USER_C, TEST_USER_LONER];
const SLUG_PREFIX = "users-repo-test-";

const runIf = process.env.DATABASE_URL ? describe : describe.skip;

runIf("DrizzleUsersRepository", () => {
  let client: DbClient;
  let repo: DrizzleUsersRepository;

  beforeAll(async () => {
    client = createDbClient({ url: process.env.DATABASE_URL!, poolMax: 2 });
    repo = new DrizzleUsersRepository(client);

    await client.db.delete(workspaces).where(like(workspaces.slug, `${SLUG_PREFIX}%`));
    await client.db
      .insert(users)
      .values([
        { id: TEST_USER_A, username: `users-repo-test-a-${TEST_USER_A}`, passwordHash: "x", role: "member" },
        { id: TEST_USER_B, username: `users-repo-test-b-${TEST_USER_B}`, passwordHash: "x", role: "member" },
        { id: TEST_USER_C, username: `users-repo-test-c-${TEST_USER_C}`, passwordHash: "x", role: "admin" },
        { id: TEST_USER_LONER, username: `users-repo-test-d-${TEST_USER_LONER}`, passwordHash: "x", role: "member" },
      ])
      .onConflictDoNothing();

    // A+B share ws1; C alone in ws2; LONER has no memberships.
    const [ws1] = await client.db
      .insert(workspaces)
      .values({ slug: `${SLUG_PREFIX}shared`, name: "shared" })
      .returning({ id: workspaces.id });
    const [ws2] = await client.db
      .insert(workspaces)
      .values({ slug: `${SLUG_PREFIX}other`, name: "other" })
      .returning({ id: workspaces.id });
    await client.db.insert(userWorkspaces).values([
      { userId: TEST_USER_A, workspaceId: ws1!.id },
      { userId: TEST_USER_B, workspaceId: ws1!.id },
      { userId: TEST_USER_C, workspaceId: ws2!.id },
    ]);
  });

  afterAll(async () => {
    await client.db.delete(workspaces).where(like(workspaces.slug, `${SLUG_PREFIX}%`));
    await client.db.delete(users).where(inArray(users.id, TEST_USER_IDS));
    await client.close();
  });

  it("listAll returns every user with id/username/role only", async () => {
    const all = await repo.listAll();
    const ids = all.map((u) => u.id);
    for (const id of TEST_USER_IDS) expect(ids).toContain(id);
    const a = all.find((u) => u.id === TEST_USER_A)!;
    expect(Object.keys(a).sort()).toEqual(["id", "role", "username"]);
    expect(a.role).toBe("member");
  });

  it("listCoWorkspaceUsers returns caller + co-members, excludes unrelated users", async () => {
    const visible = await repo.listCoWorkspaceUsers(TEST_USER_A);
    const ids = visible.map((u) => u.id);
    expect(ids).toContain(TEST_USER_A);
    expect(ids).toContain(TEST_USER_B);
    expect(ids).not.toContain(TEST_USER_C);
    expect(ids).not.toContain(TEST_USER_LONER);
  });

  it("listCoWorkspaceUsers returns no duplicate ids", async () => {
    const visible = await repo.listCoWorkspaceUsers(TEST_USER_A);
    const ids = visible.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("listCoWorkspaceUsers returns only self for a caller with no memberships", async () => {
    const visible = await repo.listCoWorkspaceUsers(TEST_USER_LONER);
    expect(visible.map((u) => u.id)).toEqual([TEST_USER_LONER]);
  });
});
