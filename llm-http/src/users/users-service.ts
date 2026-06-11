import type { SystemRole } from "@ai-connect/shared";
import type { BasicUser, UsersRepository } from "./users-repo.js";

export interface UsersService {
  listVisibleUsers(caller: {
    id: string;
    role: SystemRole;
  }): Promise<BasicUser[]>;
}

export class DefaultUsersService implements UsersService {
  constructor(private readonly repo: UsersRepository) {}

  async listVisibleUsers(caller: {
    id: string;
    role: SystemRole;
  }): Promise<BasicUser[]> {
    // Admins see the whole directory; members only co-workspace users.
    if (caller.role === "admin") {
      return this.repo.listAll();
    }
    return this.repo.listCoWorkspaceUsers(caller.id);
  }
}
