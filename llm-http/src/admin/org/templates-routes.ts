import { Router } from "express";
import { z } from "zod";
import type { OrgTemplateService } from "./templates-service.js";

// Tag pattern: lowercase letter start, then lowercase letters/digits/hyphen, max 24 chars total.
// Stored as lowercase. No `/i` flag — uppercase is rejected at the boundary.
const TemplateTag = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/);

const CreateBody = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(280).optional(),
  body: z.string().min(1).max(8000),
  tags: z.array(TemplateTag).max(6),
});

const UpdateBody = z
  .object({
    name: z.string().min(2).max(80).optional(),
    description: z.string().max(280).optional(),
    body: z.string().min(1).max(8000).optional(),
    tags: z.array(TemplateTag).max(6).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Provide at least one field to update",
  });

export function createOrgTemplatesRouter(
  service: OrgTemplateService,
): Router {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const rows = await service.list({
        userId: req.user!.id,
        orgId: req.user!.org,
      });
      res.status(200).json({ templates: rows });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const parsed = CreateBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: "invalid_input",
          message: "Invalid template payload",
          issues: parsed.error.issues,
        });
        return;
      }
      const result = await service.create(
        { userId: req.user!.id, orgId: req.user!.org },
        parsed.data,
      );
      if (!result.ok) {
        res.status(409).json({
          code: "template_name_conflict",
          message: "A template with this name already exists",
        });
        return;
      }
      res.status(201).json(result.row);
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      const parsed = UpdateBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: "invalid_input",
          message: "Invalid template payload",
          issues: parsed.error.issues,
        });
        return;
      }
      const result = await service.update(
        { userId: req.user!.id, orgId: req.user!.org },
        req.params.id,
        parsed.data,
      );
      if (!result.ok && "notFound" in result) {
        res.status(404).json({ code: "not_found", message: "Template not found" });
        return;
      }
      if (!result.ok) {
        res.status(409).json({
          code: "template_name_conflict",
          message: "A template with this name already exists",
        });
        return;
      }
      res.status(200).json(result.row);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const result = await service.delete(
        { userId: req.user!.id, orgId: req.user!.org },
        req.params.id,
      );
      if (!result.ok) {
        res.status(404).json({ code: "not_found", message: "Template not found" });
        return;
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
