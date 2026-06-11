import { Router } from "express";
import type { AppContainer } from "../container.js";

export function createUsersRoutes(container: AppContainer): Router {
  const router = Router();
  const service = container.usersService;

  router.get("/", async (req, res, next) => {
    try {
      const { id, role } = req.user!;
      const users = await service.listVisibleUsers({ id, role });
      res.json({ users });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
