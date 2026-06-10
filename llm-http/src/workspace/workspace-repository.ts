export interface WorkspaceSummary {
  id: string;
  slug: string;
  name: string;
  createdAt: Date;
}

export interface NewWorkspaceInput {
  slug: string;
  name: string;
}

export interface PageOptions {
  limit: number;
  offset: number;
}

export interface WorkspacePage {
  items: WorkspaceSummary[];
  total: number;
}

export interface WorkspacePatch {
  name?: string;
  slug?: string;
}

export interface WorkspaceRepository {
  listAll(opts: PageOptions): Promise<WorkspacePage>;
  listForUser(userId: string, opts: PageOptions): Promise<WorkspacePage>;
  create(input: NewWorkspaceInput): Promise<WorkspaceSummary>;
  /** Resolves a non-deleted workspace by id, or null when absent/deleted. */
  getById(id: string): Promise<WorkspaceSummary | null>;
  /** True when the user has a membership row for the workspace. */
  isMember(userId: string, workspaceId: string): Promise<boolean>;
  /** Applies the patch to a non-deleted workspace; null when absent/deleted. */
  update(id: string, patch: WorkspacePatch): Promise<WorkspaceSummary | null>;
  /** Soft-deletes by stamping deletedAt; false when absent/already deleted. */
  softDelete(id: string): Promise<boolean>;
}

/** Thrown by create() when the slug already exists (unique constraint). */
export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`Workspace slug already taken: ${slug}`);
    this.name = "SlugTakenError";
  }
}
