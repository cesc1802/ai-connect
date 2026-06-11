export interface ActiveWorkspace {
  id: string;
  slug: string;
  name: string;
}

export interface ActiveWorkspaceResolver {
  getForUser(userId: string): Promise<ActiveWorkspace | null>;
}
