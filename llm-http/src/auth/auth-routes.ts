import { Router } from "express";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import type { JwtSignContext } from "./jwt-service.js";
import type { UserRecord } from "./user-repository.js";

const loginBodySchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

function buildSignContext(record: UserRecord): JwtSignContext {
  return {
    org: record.org,
    orgRole: record.orgRole,
    workspace: record.workspace ?? null,
    workspaceRole: record.workspaceRole ?? null,
  };
}

export function createAuthRoutes(container: AppContainer): Router {
  const router = Router();

  router.post("/login", async (req, res, next) => {
    try {
      const parsed = loginBodySchema.safeParse(req.body);

      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        res.status(400).json({
          code: "invalid_body",
          message: firstIssue?.message ?? "Invalid request body",
        });
        return;
      }

      const { username, password } = parsed.data;
      const user = await container.credentialsVerifier.verify(username, password);

      if (!user) {
        res.status(401).json({
          code: "invalid_credentials",
          message: "Invalid username or password",
        });
        return;
      }

      const record = await container.userRepository.findByUsername(user.username);
      if (!record) {
        res.status(401).json({
          code: "invalid_credentials",
          message: "Invalid username or password",
        });
        return;
      }

      const token = container.jwtService.sign(user, buildSignContext(record));
      res.json({
        token,
        expiresIn: container.config.JWT_EXPIRES_IN,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
