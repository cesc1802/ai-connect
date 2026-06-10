import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq, like } from "drizzle-orm";
import {
  createDbClient,
  promptTemplates,
  workspaces,
  type DbClient,
} from "@ai-connect/db";
import { DrizzleWorkspaceTemplatesRepository } from "../drizzle-workspace-templates-repository.js";
import { TemplateAlreadyAttachedError } from "../workspace-templates-repository.js";

const SLUG_PREFIX_WS = "ws-tmpl-repo-test-";
const SLUG_PREFIX_TMPL = "tmpl-repo-test-";

const runIf = process.env.DATABASE_URL ? describe : describe.skip;

runIf("DrizzleWorkspaceTemplatesRepository", () => {
  let client: DbClient;
  let repo: DrizzleWorkspaceTemplatesRepository;

  beforeAll(async () => {
    client = createDbClient({ url: process.env.DATABASE_URL!, poolMax: 2 });
    repo = new DrizzleWorkspaceTemplatesRepository(client);
  });

  afterAll(async () => {
    await client.db.delete(workspaces).where(like(workspaces.slug, `${SLUG_PREFIX_WS}%`));
    await client.db.delete(promptTemplates).where(like(promptTemplates.slug, `${SLUG_PREFIX_TMPL}%`));
    await client.close();
  });

  beforeEach(async () => {
    await client.db.delete(workspaces).where(like(workspaces.slug, `${SLUG_PREFIX_WS}%`));
    await client.db.delete(promptTemplates).where(like(promptTemplates.slug, `${SLUG_PREFIX_TMPL}%`));
  });

  async function seedWorkspace(suffix: string): Promise<string> {
    const [row] = await client.db
      .insert(workspaces)
      .values({ slug: `${SLUG_PREFIX_WS}${suffix}`, name: suffix })
      .returning({ id: workspaces.id });
    return row!.id;
  }

  async function seedTemplate(suffix: string): Promise<string> {
    const [row] = await client.db
      .insert(promptTemplates)
      .values({
        slug: `${SLUG_PREFIX_TMPL}${suffix}`,
        title: suffix,
        category: "Test",
        icon: "code",
        authorName: "Tester",
        uses: 0,
        description: "test template",
      })
      .returning({ id: promptTemplates.id });
    return row!.id;
  }

  it("listLibrary returns seeded templates ordered by uses desc", async () => {
    const id1 = await seedTemplate("low-uses");
    const id2 = await seedTemplate("high-uses");
    await client.db.update(promptTemplates).set({ uses: 100 }).where(eq(promptTemplates.id, id2));

    const library = await repo.listLibrary();
    const ours = library.filter((t) => t.slug.startsWith(SLUG_PREFIX_TMPL));
    expect(ours[0]!.id).toBe(id2);
    expect(ours[1]!.id).toBe(id1);
  });

  it("templateExists returns true for existing and false for unknown", async () => {
    const id = await seedTemplate("exists-check");
    expect(await repo.templateExists(id)).toBe(true);
    expect(await repo.templateExists("00000000-0000-0000-0000-000000000000")).toBe(false);
  });

  it("attach adds a join row; listForWorkspace returns it", async () => {
    const wsId = await seedWorkspace("attach");
    const tmplId = await seedTemplate("attach-tmpl");

    await repo.attach(wsId, tmplId);
    const attached = await repo.listForWorkspace(wsId);
    expect(attached).toHaveLength(1);
    expect(attached[0]!.id).toBe(tmplId);
  });

  it("attach throws TemplateAlreadyAttachedError on duplicate", async () => {
    const wsId = await seedWorkspace("attach-dup");
    const tmplId = await seedTemplate("attach-dup-tmpl");

    await repo.attach(wsId, tmplId);
    await expect(repo.attach(wsId, tmplId)).rejects.toBeInstanceOf(TemplateAlreadyAttachedError);
  });

  it("detach removes join row and returns true", async () => {
    const wsId = await seedWorkspace("detach");
    const tmplId = await seedTemplate("detach-tmpl");

    await repo.attach(wsId, tmplId);
    const result = await repo.detach(wsId, tmplId);
    expect(result).toBe(true);

    const attached = await repo.listForWorkspace(wsId);
    expect(attached).toHaveLength(0);
  });

  it("detach returns false when not attached", async () => {
    const wsId = await seedWorkspace("detach-miss");
    const tmplId = await seedTemplate("detach-miss-tmpl");

    expect(await repo.detach(wsId, tmplId)).toBe(false);
  });

  it("listForWorkspace returns empty array when no templates attached", async () => {
    const wsId = await seedWorkspace("empty");
    const attached = await repo.listForWorkspace(wsId);
    expect(attached).toEqual([]);
  });
});
