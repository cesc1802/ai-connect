import { api } from "./api";
import type { WsRoleKey } from "./workspace-roles";

// Typed wrapper over GET /api/me/workspaces — the caller's workspace
// memberships with the workspace roles they hold there.

export interface MyWorkspace {
  id: string;
  slug: string;
  name: string;
  roles: WsRoleKey[];
}

export function listMyWorkspaces(): Promise<MyWorkspace[]> {
  return api
    .get<{ workspaces: MyWorkspace[] }>("/api/me/workspaces")
    .then((r) => r.workspaces);
}
