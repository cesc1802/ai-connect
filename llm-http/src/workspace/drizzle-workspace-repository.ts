import { eq, and, isNull, asc, count } from "drizzle-orm";
import { workspaces, userWorkspaces, type DbClient } from "@ai-connect/db";
import {
  SlugTakenError,
  type NewWorkspaceInput,
  type PageOptions,
  type WorkspacePage,
  type WorkspaceRepository,
  type WorkspaceSummary,
} from "./workspace-repository.js";

/** Postgres SQLSTATE for unique_violation (slug is the only unique column). */
const UNIQUE_VIOLATION = "23505";

const summaryColumns = {
  id: workspaces.id,
  slug: workspaces.slug,
  name: workspaces.name,
  createdAt: workspaces.createdAt,
};

export class DrizzleWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly client: DbClient) {}

  async listAll(opts: PageOptions): Promise<WorkspacePage> {
    const notDeleted = isNull(workspaces.deletedAt);

    const items = await this.client.db
      .select(summaryColumns)
      .from(workspaces)
      .where(notDeleted)
      .orderBy(asc(workspaces.createdAt), asc(workspaces.id))
      .limit(opts.limit)
      .offset(opts.offset);

    const [totalRow] = await this.client.db
      .select({ total: count() })
      .from(workspaces)
      .where(notDeleted);

    return { items, total: totalRow?.total ?? 0 };
  }

  async listForUser(userId: string, opts: PageOptions): Promise<WorkspacePage> {
    const memberAndNotDeleted = and(
      eq(userWorkspaces.userId, userId),
      isNull(workspaces.deletedAt)
    );

    const items = await this.client.db
      .select(summaryColumns)
      .from(userWorkspaces)
      .innerJoin(workspaces, eq(userWorkspaces.workspaceId, workspaces.id))
      .where(memberAndNotDeleted)
      .orderBy(asc(workspaces.createdAt), asc(workspaces.id))
      .limit(opts.limit)
      .offset(opts.offset);

    const [totalRow] = await this.client.db
      .select({ total: count() })
      .from(userWorkspaces)
      .innerJoin(workspaces, eq(userWorkspaces.workspaceId, workspaces.id))
      .where(memberAndNotDeleted);

    return { items, total: totalRow?.total ?? 0 };
  }

  async create(input: NewWorkspaceInput): Promise<WorkspaceSummary> {
    try {
      const [row] = await this.client.db
        .insert(workspaces)
        .values({ slug: input.slug, name: input.name })
        .returning(summaryColumns);
      return row!;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new SlugTakenError(input.slug);
      }
      throw err;
    }
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === UNIQUE_VIOLATION
  );
}
