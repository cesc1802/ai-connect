import { z } from 'zod';

export const WorkspaceRole = z.enum(['owner', 'admin', 'member', 'viewer']);
export type WorkspaceRole = z.infer<typeof WorkspaceRole>;

export const WorkspaceMembership = z.object({
  workspaceId: z.string(),
  userId: z.string(),
  role: WorkspaceRole,
});
export type WorkspaceMembership = z.infer<typeof WorkspaceMembership>;

export const Workspace = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  role: WorkspaceRole,
});
export type Workspace = z.infer<typeof Workspace>;

export const WorkspaceListResponse = z.object({
  workspaces: z.array(Workspace),
});
export type WorkspaceListResponse = z.infer<typeof WorkspaceListResponse>;
