import { Router } from "express";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { UsernameTakenError } from "./user-repository.js";

const loginBodySchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const registerBodySchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export function createAuthRoutes(container: AppContainer): Router {
  const router = Router();

  router.post("/login", async (req, res, next) => {
    try {
      const parsed = loginBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: "invalid_body",
          message: parsed.error.issues[0]?.message ?? "Invalid request body",
        });
        return;
      }

      const { username, password } = parsed.data;
      const result = await container.authService.login(username, password);

      if (!result) {
        res.status(401).json({
          code: "invalid_credentials",
          message: "Invalid username or password",
        });
        return;
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/register", async (req, res, next) => {
    try {
      const parsed = registerBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: "invalid_body",
          message: parsed.error.issues[0]?.message ?? "Invalid request body",
        });
        return;
      }

      const { username, password } = parsed.data;
      const user = await container.authService.register(username, password);
      res.status(201).json({ id: user.id, username: user.username });
    } catch (err) {
      if (err instanceof UsernameTakenError) {
        res.status(409).json({
          code: "username_taken",
          message: "Username is already taken",
        });
        return;
      }
      next(err);
    }
  });

  return router;
}
