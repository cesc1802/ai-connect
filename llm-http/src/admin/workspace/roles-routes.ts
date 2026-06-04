import { Router } from "express";
import type { WorkspaceRole } from "@ai-connect/shared";

interface WsRoleCatalogueEntry {
  role: WorkspaceRole;
  description: string;
}

const ROLES: readonly WsRoleCatalogueEntry[] = [
  {
    role: "owner",
    description: "Full workspace control including deletion",
  },
  {
    role: "admin",
    description: "Manage members, providers, templates, and quotas",
  },
  {
    role: "member",
    description: "Send chats and view templates",
  },
  {
    role: "viewer",
    description: "Read-only access to conversations",
  },
];

export function createWsRolesRoutes(): Router {
  const router = Router();
  router.get("/", (_req, res) => {
    res.json({ roles: ROLES });
  });
  return router;
}
