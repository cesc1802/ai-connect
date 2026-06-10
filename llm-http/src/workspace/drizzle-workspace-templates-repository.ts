import { eq, and, desc } from "drizzle-orm";
import {
  promptTemplates,
  workspaceTemplates,
  type DbClient,
} from "@ai-connect/db";
import {
  TemplateAlreadyAttachedError,
  type TemplateRow,
  type WorkspaceTemplatesRepository,
} from "./workspace-templates-repository.js";

/** Postgres SQLSTATE for unique_violation. */
const UNIQUE_VIOLATION = "23505";

const templateColumns = {
  id: promptTemplates.id,
  slug: promptTemplates.slug,
  title: promptTemplates.title,
  category: promptTemplates.category,
  icon: promptTemplates.icon,
  authorName: promptTemplates.authorName,
  uses: promptTemplates.uses,
  description: promptTemplates.description,
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
