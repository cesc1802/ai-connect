import { eq, and, desc } from "drizzle-orm";
import {
  promptTemplates,
  workspaceTemplates,
  type DbClient,
} from "@ai-connect/db";
import {
  TemplateAlreadyAttachedError,
  TemplateInUseError,
  type TemplateCreateInput,
  type TemplateRow,
  type TemplateUpdateInput,
  type WorkspaceTemplatesRepository,
} from "./workspace-templates-repository.js";

/** Postgres SQLSTATE for unique_violation. */
const UNIQUE_VIOLATION = "23505";
/** Postgres SQLSTATE for foreign_key_violation. */
const FOREIGN_KEY_VIOLATION = "23503";

const templateColumns = {
  id: promptTemplates.id,
  slug: promptTemplates.slug,
  title: promptTemplates.title,
  category: promptTemplates.category,
  icon: promptTemplates.icon,
  authorName: promptTemplates.authorName,
  uses: promptTemplates.uses,
  description: promptTemplates.description,
  body: promptTemplates.body,
};

export class DrizzleWorkspaceTemplatesRepository
  implements WorkspaceTemplatesRepository
{
  constructor(private readonly client: DbClient) {}

  async listLibrary(): Promise<TemplateRow[]> {
    return this.client.db
      .select(templateColumns)
      .from(promptTemplates)
      .orderBy(desc(promptTemplates.uses));
  }

  async createTemplate(input: TemplateCreateInput): Promise<TemplateRow> {
    const [row] = await this.client.db
      .insert(promptTemplates)
      .values(input)
      .returning(templateColumns);
    if (!row) throw new Error("Insert returned no row");
    return row;
  }

  async updateTemplate(
    id: string,
    input: TemplateUpdateInput
  ): Promise<TemplateRow | undefined> {
    // Drop undefined keys — drizzle's .set() rejects them under exactOptionalPropertyTypes.
    const patch: {
      title?: string;
      category?: string;
      icon?: string;
      description?: string;
      body?: string | null;
    } = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.category !== undefined) patch.category = input.category;
    if (input.icon !== undefined) patch.icon = input.icon;
    if (input.description !== undefined) patch.description = input.description;
    if (input.body !== undefined) patch.body = input.body;

    const [row] = await this.client.db
      .update(promptTemplates)
      .set(patch)
      .where(eq(promptTemplates.id, id))
      .returning(templateColumns);
    return row;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    try {
      const rows = await this.client.db
        .delete(promptTemplates)
        .where(eq(promptTemplates.id, id))
        .returning({ id: promptTemplates.id });
      return rows.length > 0;
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new TemplateInUseError(id);
      }
      throw err;
    }
  }

  async listForWorkspace(workspaceId: string): Promise<TemplateRow[]> {
    return this.client.db
      .select(templateColumns)
      .from(workspaceTemplates)
      .innerJoin(
        promptTemplates,
        eq(workspaceTemplates.templateId, promptTemplates.id)
      )
      .where(eq(workspaceTemplates.workspaceId, workspaceId))
      .orderBy(desc(promptTemplates.uses));
  }

  async attach(workspaceId: string, templateId: string): Promise<boolean> {
    try {
      await this.client.db
        .insert(workspaceTemplates)
        .values({ workspaceId, templateId });
      return true;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new TemplateAlreadyAttachedError(templateId, workspaceId);
      }
      throw err;
    }
  }

  async detach(workspaceId: string, templateId: string): Promise<boolean> {
    const rows = await this.client.db
      .delete(workspaceTemplates)
      .where(
        and(
          eq(workspaceTemplates.workspaceId, workspaceId),
          eq(workspaceTemplates.templateId, templateId)
        )
      )
      .returning({ workspaceId: workspaceTemplates.workspaceId });
    return rows.length > 0;
  }

  async getTemplate(templateId: string): Promise<TemplateRow | undefined> {
    const [row] = await this.client.db
      .select(templateColumns)
      .from(promptTemplates)
      .where(eq(promptTemplates.id, templateId))
      .limit(1);
    return row;
  }

  async templateExists(templateId: string): Promise<boolean> {
    const [row] = await this.client.db
      .select({ id: promptTemplates.id })
      .from(promptTemplates)
      .where(eq(promptTemplates.id, templateId))
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

function isForeignKeyViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === FOREIGN_KEY_VIOLATION
  );
}
