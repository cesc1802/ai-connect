import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq, like } from "drizzle-orm";
import {
  createDbClient,
  workspaces,
  users,
  userWorkspaces,
  type DbClient,
} from "@ai-connect/db";
import { DrizzleWorkspaceRepository } from "../drizzle-workspace-repository.js";
import { SlugTakenError } from "../workspace-repository.js";

// Dedicated identity for this file so its cleanup never races other test files.
const TEST_USER_ID = "00000000-0000-0000-0000-0000000000e1";
const SLUG_PREFIX = "ws-repo-test-";

// Live DB tests; skipped unless DATABASE_URL points at a migrated Postgres.
const runIf = process.env.DATABASE_URL ? describe : describe.skip;

runIf("DrizzleWorkspaceRepository", () => {
  let client: DbClient;
  let repo: DrizzleWorkspaceRepository;

  beforeAll(async () => {
    client = createDbClient({ url: process.env.DATABASE_URL!, poolMax: 2 });
    repo = new DrizzleWorkspaceRepository(client);
    await client.db
      .insert(users)
      .values({
        id: TEST_USER_ID,
        username: TEST_USER_ID,
        passwordHash: "test-no-login",
        role: "member",
      })
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    // Remove rows from prior runs; membership rows cascade with workspaces.
    await client.db
      .delete(workspaces)
      .where(like(workspaces.slug, `${SLUG_PREFIX}%`));
  });

  afterAll(async () => {
    await client.db
      .delete(workspaces)
      .where(like(workspaces.slug, `${SLUG_PREFIX}%`));
    await client.db.delete(users).where(eq(users.id, TEST_USER_ID));
    await client.close();
  });

  async function seedWorkspaces(slugs: string[]): Promise<string[]> {
    const rows = await client.db
      .insert(workspaces)
      .values(slugs.map((s) => ({ slug: SLUG_PREFIX + s, name: s })))
      .returning({ id: workspaces.id });
    return rows.map((r) => r.id);
  }

  it("listAll returns seeded workspaces with a stable total", async () => {
    await seedWorkspaces(["alpha", "beta"]);

    const page = await repo.listAll({ limit: 100, offset: 0 });

    // The shared DB may hold rows from other test files; filter to ours.
    const ours = page.items.filter((w) => w.slug.startsWith(SLUG_PREFIX));
    expect(ours.map((w) => w.slug).sort()).toEqual([
      `${SLUG_PREFIX}alpha`,
      `${SLUG_PREFIX}beta`,
    ]);
    expect(page.total).toBeGreaterThanOrEqual(2);
  });

  it("listAll respects limit and offset ordering by createdAt", async () => {
    await seedWorkspaces(["page-a", "page-b"]);

    const all = await repo.listAll({ limit: 1000, offset: 0 });
    const first = await repo.listAll({ limit: 1, offset: 0 });
    const second = await repo.listAll({ limit: 1, offset: 1 });

    expect(first.items).toHaveLength(1);
    expect(second.items).toHaveLength(1);
    expect(first.items[0]!.id).toBe(all.items[0]!.id);
    expect(second.items[0]!.id).toBe(all.items[1]!.id);
    expect(first.total).toBe(all.total);
  });

  it("listForUser returns only membership-joined workspaces", async () => {
    const [memberWsId] = await seedWorkspaces(["mine", "not-mine"]);
    await client.db
      .insert(userWorkspaces)
      .values({ userId: TEST_USER_ID, workspaceId: memberWsId! });

    const page = await repo.listForUser(TEST_USER_ID, { limit: 100, offset: 0 });

    expect(page.items.map((w) => w.slug)).toEqual([`${SLUG_PREFIX}mine`]);
    expect(page.total).toBe(1);
  });

  it("excludes soft-deleted workspaces from both lists", async () => {
    const ids = await seedWorkspaces(["kept", "gone"]);
    await client.db
      .insert(userWorkspaces)
      .values(ids.map((workspaceId) => ({ userId: TEST_USER_ID, workspaceId })));
    await client.db
      .update(workspaces)
      .set({ deletedAt: new Date() })
      .where(eq(workspaces.slug, `${SLUG_PREFIX}gone`));

    const all = await repo.listAll({ limit: 1000, offset: 0 });
    const mine = await repo.listForUser(TEST_USER_ID, { limit: 100, offset: 0 });

    expect(all.items.map((w) => w.slug)).not.toContain(`${SLUG_PREFIX}gone`);
    expect(mine.items.map((w) => w.slug)).toEqual([`${SLUG_PREFIX}kept`]);
    expect(mine.total).toBe(1);
  });

  it("create persists and returns the new workspace", async () => {
    const created = await repo.create({
      slug: `${SLUG_PREFIX}fresh`,
      name: "Fresh",
    });

    expect(created.id).toBeTruthy();
    expect(created.slug).toBe(`${SLUG_PREFIX}fresh`);
    expect(created.name).toBe("Fresh");
    expect(created.createdAt).toBeInstanceOf(Date);

    const [row] = await client.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, created.id));
    expect(row?.slug).toBe(`${SLUG_PREFIX}fresh`);
  });

  it("create throws SlugTakenError on duplicate slug", async () => {
    await repo.create({ slug: `${SLUG_PREFIX}dup`, name: "First" });

    await expect(
      repo.create({ slug: `${SLUG_PREFIX}dup`, name: "Second" })
    ).rejects.toBeInstanceOf(SlugTakenError);
  });
});
