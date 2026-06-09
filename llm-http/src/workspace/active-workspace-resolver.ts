import {
  DEV_WORKSPACE_ID,
  DEV_WORKSPACE_SLUG,
  DEV_WORKSPACE_NAME,
} from "../auth/dev-seed-constants.js";

export interface ActiveWorkspace {
  id: string;
  slug: string;
  name: string;
}

export interface ActiveWorkspaceResolver {
  getForUser(userId: string): Promise<ActiveWorkspace | null>;
}

/** Single-tenant dev fallback: always resolves to the seeded dev workspace. */
export class InMemoryActiveWorkspaceResolver implements ActiveWorkspaceResolver {
  async getForUser(_userId: string): Promise<ActiveWorkspace | null> {
    return {
      id: DEV_WORKSPACE_ID,
      slug: DEV_WORKSPACE_SLUG,
      name: DEV_WORKSPACE_NAME,
    };
  }
}
