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

export interface WorkspaceRepository {
  listAll(opts: PageOptions): Promise<WorkspacePage>;
  listForUser(userId: string, opts: PageOptions): Promise<WorkspacePage>;
  create(input: NewWorkspaceInput): Promise<WorkspaceSummary>;
}

/** Thrown by create() when the slug already exists (unique constraint). */
export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`Workspace slug already taken: ${slug}`);
    this.name = "SlugTakenError";
  }
}
