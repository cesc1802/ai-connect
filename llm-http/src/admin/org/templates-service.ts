import { randomUUID } from "node:crypto";
import type { AuditEmitter } from "@ai-connect/shared";
import type {
  OrgTemplateCreateInput,
  OrgTemplateRepo,
  OrgTemplateRow,
  OrgTemplateUpdateInput,
} from "./templates-repo.js";

export type CreateOutcome =
  | { ok: true; row: OrgTemplateRow }
  | { ok: false; conflict: "name" };

export type UpdateOutcome =
  | { ok: true; row: OrgTemplateRow }
  | { ok: false; notFound: true }
  | { ok: false; conflict: "name" };

export type DeleteOutcome = { ok: true } | { ok: false; notFound: true };

interface Actor {
  userId: string;
  orgId: string;
}

const BODY_AUDIT_TRUNCATE = 500;

function snapshotForAudit(row: OrgTemplateRow): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    body: row.body.length > BODY_AUDIT_TRUNCATE
      ? row.body.slice(0, BODY_AUDIT_TRUNCATE)
      : row.body,
    tags: [...row.tags],
    updatedAt: row.updatedAt,
  };
}

export class OrgTemplateService {
  constructor(
    private readonly repo: OrgTemplateRepo,
    private readonly audit: AuditEmitter,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async list(actor: Actor): Promise<OrgTemplateRow[]> {
    return this.repo.list(actor.orgId);
  }

  async create(
    actor: Actor,
    input: OrgTemplateCreateInput,
  ): Promise<CreateOutcome> {
    const existing = await this.repo.findByName(actor.orgId, input.name);
    if (existing) return { ok: false, conflict: "name" };
    const row = await this.repo.create(actor.orgId, input);
    await this.audit.emit({
      id: randomUUID(),
      ts: this.clock().toISOString(),
      actor: { userId: actor.userId, orgId: actor.orgId },
      action: "template.created",
      target: { kind: "template", id: row.id },
      after: snapshotForAudit(row),
    });
    return { ok: true, row };
  }

  async update(
    actor: Actor,
    id: string,
    input: OrgTemplateUpdateInput,
  ): Promise<UpdateOutcome> {
    const before = await this.repo.findById(actor.orgId, id);
    if (!before) return { ok: false, notFound: true };
    if (input.name !== undefined && input.name.toLowerCase() !== before.name.toLowerCase()) {
      const collide = await this.repo.findByName(actor.orgId, input.name);
      if (collide && collide.id !== id) {
        return { ok: false, conflict: "name" };
      }
    }
    const after = await this.repo.update(actor.orgId, id, input);
    if (!after) return { ok: false, notFound: true };
    await this.audit.emit({
      id: randomUUID(),
      ts: this.clock().toISOString(),
      actor: { userId: actor.userId, orgId: actor.orgId },
      action: "template.updated",
      target: { kind: "template", id },
      before: snapshotForAudit(before),
      after: snapshotForAudit(after),
    });
    return { ok: true, row: after };
  }

  async delete(actor: Actor, id: string): Promise<DeleteOutcome> {
    const before = await this.repo.findById(actor.orgId, id);
    if (!before) return { ok: false, notFound: true };
    const removed = await this.repo.delete(actor.orgId, id);
    if (!removed) return { ok: false, notFound: true };
    await this.audit.emit({
      id: randomUUID(),
      ts: this.clock().toISOString(),
      actor: { userId: actor.userId, orgId: actor.orgId },
      action: "template.deleted",
      target: { kind: "template", id },
      before: snapshotForAudit(before),
    });
    return { ok: true };
  }
}
