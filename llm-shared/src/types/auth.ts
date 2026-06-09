export interface User {
  id: string;
  username: string;
}

export type SystemRole = "admin" | "member";

export type OrgRole = "admin" | "member";
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export interface JWTPayload {
  sub: string;
  username: string;
  iat: number;
  exp: number;
}
