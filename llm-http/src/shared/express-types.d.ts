import type { SystemRole, OrgRole, WorkspaceRole } from "@ai-connect/shared";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: SystemRole;
        org: string;
        orgRole: OrgRole;
        workspace: string | null;
        workspaceRole: WorkspaceRole | null;
      };
    }
  }
}

export {};
