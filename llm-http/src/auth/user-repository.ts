import type { OrgRole, WorkspaceRole } from "@ai-connect/shared";

// UserRecord lives in-memory only until the persistence layer lands.
// New fields are required so JwtService can sign org/workspace claims.
export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  org: string;
  orgRole: OrgRole;
  workspace?: string | null | undefined;
  workspaceRole?: WorkspaceRole | null | undefined;
}

export interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
}
