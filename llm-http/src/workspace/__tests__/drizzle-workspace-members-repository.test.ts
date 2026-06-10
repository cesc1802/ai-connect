import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq, like } from "drizzle-orm";
import {
  createDbClient,
  users,
  workspaces,
  userWorkspaces,
  userRoleWorkspaces,
  type DbClient,
} from "@ai-connect/db";
import { DrizzleWorkspaceMembersRepository } from "../drizzle-workspace-members-repository.js";
import { MemberExistsError, MemberNotFoundError } from "../workspace-members-repository.js";

// Dedicated stable IDs scoped to this test file to avoid races with other files.
const TEST_USER_A = "00000000-0000-0000-ffff-000000000a01";
const TEST_USER_B = "00000000-0000-0000-ffff-000000000a02";
const SLUG_PREFIX = "ws-members-repo-test-";

const runIf = process.env.DATABASE_URL ? describe : describe.skip;

runIf("DrizzleWorkspaceMembersRepository", () => {
  let client: DbClient;
  let repo: DrizzleWorkspaceMembersRepository;

  beforeAll(async () => {
    client = createDbClient({ url: process.env.DATABASE_URL!, poolMax: 2 });
    repo = new DrizzleWorkspaceMembersRepository(client);

    // Seed stable test users; safe to re-run.
    await client.db
      .insert(users)
      .values([
        { id: TEST_USER_A, username: `member-repo-test-a-${TEST_USER_A}`, passwordHash: "x", role: "member" },
        { id: TEST_USER_B, username: `member-repo-test-b-${TEST_USER_B}`, passwordHash: "x", role: "admin" },
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await client.db.delete(workspaces).where(like(workspaces.slug, `${SLUG_PREFIX}%`));
    await client.db.delete(users).where(eq(users.id, TEST_USER_A));
    await client.db.delete(users).where(eq(users.id, TEST_USER_B));
    await client.close();
  });

  async function seedWorkspace(suffix: string): Promise<string> {
    const [row] = await client.db
      .insert(workspaces)
      .values({ slug: `${SLUG_PREFIX}${suffix}`, name: suffix })
      .returning({ id: workspaces.id });
    return row!.id;
  }

  beforeEach(async () => {
    await client.db.delete(workspaces).where(like(workspaces.slug, `${SLUG_PREFIX}%`));
  });

  it("userExists returns true for existing user and false for unknown", async () => {
    expect(await repo.userExists(TEST_USER_A)).toBe(true);
    expect(await repo.userExists("00000000-0000-0000-0000-000000000000")).toBe(false);
  });

  it("isMember reflects membership table correctly", async () => {
    const wsId = await seedWorkspace("memb-check");
    await client.db.insert(userWorkspaces).values({ userId: TEST_USER_A, workspaceId: wsId });

    expect(await repo.isMember(TEST_USER_A, wsId)).toBe(true);
    expect(await repo.isMember(TEST_USER_B, wsId)).toBe(false);
  });

  it("add inserts membership + roles, list returns them", async () => {
    const wsId = await seedWorkspace("add-list");
    await repo.add(wsId, TEST_USER_A, ["dev", "qa"]);

    const members = await repo.list(wsId);
    expect(members).toHaveLength(1);
    expect(members[0]!.userId).toBe(TEST_USER_A);
    expect(members[0]!.wsRoles.sort()).toEqual(["dev", "qa"].sort());
    expect(members[0]!.orgRole).toBe("member");
  });

  it("add throws MemberExistsError on duplicate", async () => {
    const wsId = await seedWorkspace("add-dup");
    await repo.add(wsId, TEST_USER_A, ["dev"]);
    await expect(repo.add(wsId, TEST_USER_A, ["pm"])).rejects.toBeInstanceOf(MemberExistsError);
  });

  it("replaceRoles swaps roles for existing member", async () => {
    const wsId = await seedWorkspace("replace-roles");
    await repo.add(wsId, TEST_USER_A, ["dev"]);

    await repo.replaceRoles(wsId, TEST_USER_A, ["pm", "ba"]);

    const members = await repo.list(wsId);
    expect(members[0]!.wsRoles.sort()).toEqual(["ba", "pm"].sort());
  });

  it("replaceRoles throws MemberNotFoundError when not a member", async () => {
    const wsId = await seedWorkspace("replace-not-member");
    await expect(
      repo.replaceRoles(wsId, TEST_USER_A, ["dev"])
    ).rejects.toBeInstanceOf(MemberNotFoundError);
  });

  it("remove deletes membership and cascades role rows", async () => {
    const wsId = await seedWorkspace("remove");
    await repo.add(wsId, TEST_USER_A, ["dev"]);

    const removed = await repo.remove(wsId, TEST_USER_A);
    expect(removed).toBe(true);

    expect(await repo.isMember(TEST_USER_A, wsId)).toBe(false);

    // Role rows must also be gone (cascade).
    const roleRows = await client.db
      .select()
      .from(userRoleWorkspaces)
      .where(eq(userRoleWorkspaces.userId, TEST_USER_A));
    expect(roleRows.filter((r) => r.workspaceId === wsId)).toHaveLength(0);
  });

  it("remove returns false when not a member", async () => {
    const wsId = await seedWorkspace("remove-miss");
    expect(await repo.remove(wsId, TEST_USER_A)).toBe(false);
  });

  it("listCandidates returns org users not yet in the workspace", async () => {
    const wsId = await seedWorkspace("candidates");
    await repo.add(wsId, TEST_USER_A, ["dev"]);

    const candidates = await repo.listCandidates(wsId);
    const ids = candidates.map((c) => c.userId);
    expect(ids).toContain(TEST_USER_B);
    expect(ids).not.toContain(TEST_USER_A);
  });

  it("list returns empty array for workspace with no members", async () => {
    const wsId = await seedWorkspace("empty");
    const members = await repo.list(wsId);
    expect(members).toEqual([]);
  });
});
