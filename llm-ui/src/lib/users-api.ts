import { api } from "./api";
import type { OrgRole } from "./workspace-types";

// Thin typed wrapper over GET /users. Server scopes the list by caller
// role: admins see every user, members only co-workspace users.

export interface ApiUser {
  id: string;
  username: string;
  role: OrgRole;
}

export function listUsers(): Promise<ApiUser[]> {
  return api.get<{ users: ApiUser[] }>("/users").then((r) => r.users);
}
