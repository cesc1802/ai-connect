import { Router } from "express";
import { z } from "zod";
import { PROVIDER_KINDS } from "./provider-kind.js";
import {
  ProviderDuplicateNameError,
  ProviderNotFoundError,
  type OrgProvidersService,
  type ServiceActor,
} from "./providers-service.js";

const providerKindSchema = z.enum(PROVIDER_KINDS);

const addProviderBody = z.object({
  displayName: z.string().trim().min(1, "displayName is required").max(80),
  providerKind: providerKindSchema,
  apiKey: z.string().min(8, "apiKey must be at least 8 characters"),
});

const updateProviderBody = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    isEnabled: z.boolean().optional(),
  })
  .refine(
    (v) => v.displayName !== undefined || v.isEnabled !== undefined,
    { message: "No updatable fields supplied" },
  );

const rotateKeyBody = z.object({
  apiKey: z.string().min(8, "apiKey must be at least 8 characters"),
});

function badBody(message: string) {
  return { status: 400, body: { code: "invalid_body", message } };
}

function requireActor(req: { user?: { id: string; org: string } }): ServiceActor | null {
  if (!req.user) return null;
  return { userId: req.user.id, orgId: req.user.org };
}

export function createOrgProvidersRoutes(
  service: OrgProvidersService,
): Router {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const actor = requireActor(req);
      if (!actor) {
        res.status(401).json({ code: "unauthenticated", message: "Unauthenticated" });
        return;
      }
      const providers = await service.list(actor.orgId);
      res.json({ providers });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const actor = requireActor(req);
      if (!actor) {
        res.status(401).json({ code: "unauthenticated", message: "Unauthenticated" });
        return;
      }
      const parsed = addProviderBody.safeParse(req.body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const { status, body } = badBody(issue?.message ?? "Invalid request body");
        res.status(status).json(body);
        return;
      }
      const provider = await service.add(actor, parsed.data);
      res.status(201).json({ provider });
    } catch (err) {
      if (err instanceof ProviderDuplicateNameError) {
        res.status(409).json({ code: err.code, message: err.message });
        return;
      }
      next(err);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      const actor = requireActor(req);
      if (!actor) {
        res.status(401).json({ code: "unauthenticated", message: "Unauthenticated" });
        return;
      }
      const parsed = updateProviderBody.safeParse(req.body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const { status, body } = badBody(issue?.message ?? "Invalid request body");
        res.status(status).json(body);
        return;
      }
      const provider = await service.update(actor, req.params.id, parsed.data);
      res.json({ provider });
    } catch (err) {
      if (err instanceof ProviderNotFoundError) {
        res.status(404).json({ code: err.code, message: err.message });
        return;
      }
      if (err instanceof ProviderDuplicateNameError) {
        res.status(409).json({ code: err.code, message: err.message });
        return;
      }
      next(err);
    }
  });

  router.post("/:id/rotate-key", async (req, res, next) => {
    try {
      const actor = requireActor(req);
      if (!actor) {
        res.status(401).json({ code: "unauthenticated", message: "Unauthenticated" });
        return;
      }
      const parsed = rotateKeyBody.safeParse(req.body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const { status, body } = badBody(issue?.message ?? "Invalid request body");
        res.status(status).json(body);
        return;
      }
      const provider = await service.rotateKey(actor, req.params.id, parsed.data);
      res.json({ provider });
    } catch (err) {
      if (err instanceof ProviderNotFoundError) {
        res.status(404).json({ code: err.code, message: err.message });
        return;
      }
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const actor = requireActor(req);
      if (!actor) {
        res.status(401).json({ code: "unauthenticated", message: "Unauthenticated" });
        return;
      }
      await service.delete(actor, req.params.id);
      res.status(204).send();
    } catch (err) {
      if (err instanceof ProviderNotFoundError) {
        res.status(404).json({ code: err.code, message: err.message });
        return;
      }
      next(err);
    }
  });

  return router;
}
