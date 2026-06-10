/** Workspace-level role values — enum validated at the route layer. */
export type WsRole = "wsadmin" | "pm" | "ba" | "qa" | "dev";

export interface WorkspaceMember {
  userId: string;
  username: string;
  /** Zero or more workspace roles. */
  wsRoles: WsRole[];
  /** System role from the users table ("admin" | "member"). */
  orgRole: string;
}

export interface WorkspaceMembersRepository {
  /** List all members of a workspace with their roles. */
  list(workspaceId: string): Promise<WorkspaceMember[]>;
  /**
   * List org users who are NOT yet members of the workspace.
   * Used to populate the Add Member candidate list.
   */
  listCandidates(
    workspaceId: string
  ): Promise<Array<{ userId: string; username: string; orgRole: string }>>;
  /** Add a user to a workspace with an initial set of roles (transactional). */
  add(workspaceId: string, userId: string, roles: WsRole[]): Promise<void>;
  /** Replace the full role set for an existing member (transactional). */
  replaceRoles(workspaceId: string, userId: string, roles: WsRole[]): Promise<void>;
  /** Remove a member; returns false if the membership row does not exist. */
  remove(workspaceId: string, userId: string): Promise<boolean>;
  /** True when the user has a membership row for the workspace. */
  isMember(userId: string, workspaceId: string): Promise<boolean>;
  /** True when a user with the given id exists in the users table. */
  userExists(userId: string): Promise<boolean>;
}

/** Thrown by add() when the user is already a member. */
export class MemberExistsError extends Error {
  constructor(userId: string, workspaceId: string) {
    super(`User ${userId} is already a member of workspace ${workspaceId}`);
    this.name = "MemberExistsError";
  }
}

/** Thrown by replaceRoles() when the user is not a member. */
export class MemberNotFoundError extends Error {
  constructor(userId: string, workspaceId: string) {
    super(`User ${userId} is not a member of workspace ${workspaceId}`);
    this.name = "MemberNotFoundError";
  }
}

/** Thrown by add() when the target user does not exist. */
export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.name = "UserNotFoundError";
  }
}
