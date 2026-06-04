export interface User {
  id: string;
  username: string;
}

export type OrgRole = "admin" | "member";
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export interface JWTPayload {
  sub: string;
  username: string;
  org: string;
  orgRole: OrgRole;
  workspace: string | null;
  workspaceRole: WorkspaceRole | null;
  iat: number;
  exp: number;
}
