import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express, type RequestHandler } from "express";
import request from "supertest";
import type { AuditEmitter, AuditEvent, OrgRole } from "@ai-connect/shared";
import { InMemoryOrgTemplateRepo } from "./templates-repo.js";
import { OrgTemplateService } from "./templates-service.js";
import { createOrgTemplatesRouter } from "./templates-routes.js";
import { createRequireOrgAdmin } from "../../auth/auth-middleware.js";

function makeAuthStub(orgRole: OrgRole): RequestHandler {
  return (req, _res, next) => {
    req.user = {
      id: "user-1",
      username: "alice",
      role: orgRole,
      org: "org-1",
      orgRole,
      workspace: null,
      workspaceRole: null,
    };
    next();
  };
}

function makeApp(orgRole: OrgRole, audit: AuditEmitter) {
  const repo = new InMemoryOrgTemplateRepo();
  const service = new OrgTemplateService(repo, audit);
  const app: Express = express();
  app.use(express.json());
  app.use(makeAuthStub(orgRole));
  app.use(
    "/admin/org/templates",
    createRequireOrgAdmin(),
    createOrgTemplatesRouter(service),
  );
  return { app, repo, service };
}

function makeAuditSpy(): { emitter: AuditEmitter; events: AuditEvent[] } {
  const events: AuditEvent[] = [];
  const emitter: AuditEmitter = {
    emit: vi.fn(async (e: AuditEvent) => {
      events.push(e);
    }),
  };
  return { emitter, events };
}

describe("Org Template Routes", () => {
  let audit: ReturnType<typeof makeAuditSpy>;

  beforeEach(() => {
    audit = makeAuditSpy();
  });

  describe("GET /admin/org/templates", () => {
    it("returns 200 with empty list initially", async () => {
      const { app } = makeApp("admin", audit.emitter);
      const res = await request(app).get("/admin/org/templates");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ templates: [] });
    });

    it("returns rows after create", async () => {
      const { app } = makeApp("admin", audit.emitter);
      await request(app).post("/admin/org/templates").send({
        name: "Summarize",
        body: "Summarize: {input}",
        tags: ["chat"],
      });
      const res = await request(app).get("/admin/org/templates");
      expect(res.status).toBe(200);
      expect(res.body.templates).toHaveLength(1);
      expect(res.body.templates[0].name).toBe("Summarize");
    });

    it("returns 403 for non-admin member", async () => {
      const { app } = makeApp("member", audit.emitter);
      const res = await request(app).get("/admin/org/templates");
      expect(res.status).toBe(403);
    });
  });

  describe("POST /admin/org/templates", () => {
    it("creates a template and emits template.created", async () => {
      const { app } = makeApp("admin", audit.emitter);
      const res = await request(app)
        .post("/admin/org/templates")
        .send({ name: "T1", body: "hello", tags: ["a"] });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: "T1", body: "hello", tags: ["a"] });
      expect(res.body.id).toBeTruthy();
      expect(audit.events).toHaveLength(1);
      expect(audit.events[0].action).toBe("template.created");
      expect(audit.events[0].target).toMatchObject({ kind: "template" });
    });

    it("returns 409 on duplicate name (case-insensitive)", async () => {
      const { app } = makeApp("admin", audit.emitter);
      await request(app)
        .post("/admin/org/templates")
        .send({ name: "Summarize", body: "x", tags: [] });
      const res = await request(app)
        .post("/admin/org/templates")
        .send({ name: "summarize", body: "y", tags: [] });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("template_name_conflict");
    });

    it("returns 400 on invalid tag (uppercase)", async () => {
      const { app } = makeApp("admin", audit.emitter);
      const res = await request(app)
        .post("/admin/org/templates")
        .send({ name: "T1", body: "x", tags: ["Bad"] });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("invalid_input");
    });

    it("returns 403 for non-admin member", async () => {
      const { app } = makeApp("member", audit.emitter);
      const res = await request(app)
        .post("/admin/org/templates")
        .send({ name: "T1", body: "x", tags: [] });
      expect(res.status).toBe(403);
      expect(audit.events).toHaveLength(0);
    });
  });

  describe("PATCH /admin/org/templates/:id", () => {
    it("updates a template and emits template.updated", async () => {
      const { app } = makeApp("admin", audit.emitter);
      const created = await request(app)
        .post("/admin/org/templates")
        .send({ name: "T1", body: "x", tags: [] });
      const id = created.body.id as string;
      audit.events.length = 0;

      const res = await request(app)
        .patch(`/admin/org/templates/${id}`)
        .send({ body: "y" });
      expect(res.status).toBe(200);
      expect(res.body.body).toBe("y");
      expect(audit.events[0].action).toBe("template.updated");
      expect(audit.events[0].before).toMatchObject({ body: "x" });
      expect(audit.events[0].after).toMatchObject({ body: "y" });
    });

    it("returns 404 on missing id", async () => {
      const { app } = makeApp("admin", audit.emitter);
      const res = await request(app)
        .patch("/admin/org/templates/missing")
        .send({ body: "y" });
      expect(res.status).toBe(404);
    });

    it("returns 409 on rename collision", async () => {
      const { app } = makeApp("admin", audit.emitter);
      const a = await request(app)
        .post("/admin/org/templates")
        .send({ name: "Alpha", body: "x", tags: [] });
      await request(app)
        .post("/admin/org/templates")
        .send({ name: "Beta", body: "y", tags: [] });
      const res = await request(app)
        .patch(`/admin/org/templates/${a.body.id}`)
        .send({ name: "Beta" });
      expect(res.status).toBe(409);
    });

    it("allows renaming to same name case-change without 409", async () => {
      const { app } = makeApp("admin", audit.emitter);
      const a = await request(app)
        .post("/admin/org/templates")
        .send({ name: "Alpha", body: "x", tags: [] });
      const res = await request(app)
        .patch(`/admin/org/templates/${a.body.id}`)
        .send({ name: "Alpha" });
      expect(res.status).toBe(200);
    });

    it("returns 403 for non-admin member", async () => {
      const { app, repo } = makeApp("member", audit.emitter);
      await repo.create("org-1", {
        name: "T1",
        body: "x",
        tags: [],
      });
      const res = await request(app)
        .patch("/admin/org/templates/tpl_1")
        .send({ body: "y" });
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /admin/org/templates/:id", () => {
    it("deletes a template and emits template.deleted", async () => {
      const { app } = makeApp("admin", audit.emitter);
      const created = await request(app)
        .post("/admin/org/templates")
        .send({ name: "T1", body: "x", tags: [] });
      audit.events.length = 0;
      const res = await request(app).delete(
        `/admin/org/templates/${created.body.id}`,
      );
      expect(res.status).toBe(204);
      expect(audit.events[0].action).toBe("template.deleted");
      expect(audit.events[0].before).toMatchObject({ name: "T1" });
    });

    it("returns 404 on missing id", async () => {
      const { app } = makeApp("admin", audit.emitter);
      const res = await request(app).delete("/admin/org/templates/missing");
      expect(res.status).toBe(404);
    });

    it("returns 403 for non-admin member", async () => {
      const { app, repo } = makeApp("member", audit.emitter);
      await repo.create("org-1", { name: "T1", body: "x", tags: [] });
      const res = await request(app).delete("/admin/org/templates/tpl_1");
      expect(res.status).toBe(403);
    });
  });
});
