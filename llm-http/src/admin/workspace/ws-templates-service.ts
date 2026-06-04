import { createHash, randomUUID } from "node:crypto";
import type {
  AuditEmitter,
  AuditEvent,
  WorkspaceRole,
} from "@ai-connect/shared";
import type { Logger } from "../../logger.js";
import type { OrgTemplateRepo } from "../org/templates-repo.js";
import type {
  StoredTemplateBinding,
  WsTemplateBindingsRepo,
} from "./ws-templates-repo.js";

export interface WireWsTemplate {
  templateId: string;
  name: string;
  suggestedRole?: WorkspaceRole;
}

export interface WireBoundTemplate {
  templateId: string;
  name: string;
  suggestedRole: WorkspaceRole;
}

export interface WsTemplateListResponse {
  available: WireWsTemplate[];
  bound: WireBoundTemplate[];
  etag: string;
}

export interface WsActor {
  userId: string;
  orgId: string;
  workspaceId: string;
}

export class NotInOrgPoolError extends Error {
  readonly code = "not_in_org_pool";
  constructor(readonly invalidIds: string[]) {
    super(`Template ids not in org pool: ${invalidIds.join(", ")}`);
  }
}

export class EtagMismatchError extends Error {
  readonly code = "etag_mismatch";
  constructor() {
    super("Binding set has changed; refetch and retry.");
  }
}

export function computeTemplatesEtag(
  bindings: readonly StoredTemplateBinding[],
): string {
  const payload = [...bindings]
    .map((b) => `${b.templateId}|${b.suggestedRole}`)
    .sort()
    .join(",");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export interface PutTemplatePair {
  templateId: string;
  suggestedRole: WorkspaceRole;
}

interface RoleChangeEntry {
  templateId: string;
  before: WorkspaceRole;
  after: WorkspaceRole;
}

export class WsTemplatesService {
  constructor(
    private readonly bindingsRepo: WsTemplateBindingsRepo,
    private readonly orgPoolRepo: OrgTemplateRepo,
    private readonly auditEmitter: AuditEmitter,
    private readonly logger: Logger,
  ) {}

  async list(actor: WsActor): Promise<WsTemplateListResponse> {
    const poolRows = await this.orgPoolRepo.list(actor.orgId);
    const poolIndex = new Map(poolRows.map((r) => [r.id, r]));
    const stored = await this.bindingsRepo.get(actor.orgId, actor.workspaceId);
    const validStored = stored.filter((b) => poolIndex.has(b.templateId));
    const boundIds = new Set(validStored.map((b) => b.templateId));
    const bound: WireBoundTemplate[] = validStored.map((b) => ({
      templateId: b.templateId,
      name: poolIndex.get(b.templateId)!.name,
      suggestedRole: b.suggestedRole,
    }));
    const available: WireWsTemplate[] = poolRows
      .filter((r) => !boundIds.has(r.id))
      .map((r) => ({ templateId: r.id, name: r.name }));
    return {
      available,
      bound,
      etag: computeTemplatesEtag(validStored),
    };
  }

  async replace(
    actor: WsActor,
    pairs: PutTemplatePair[],
    ifMatch: string | null,
  ): Promise<WsTemplateListResponse> {
    const before = await this.bindingsRepo.get(actor.orgId, actor.workspaceId);
    const currentEtag = computeTemplatesEtag(before);
    if (ifMatch !== null && ifMatch !== currentEtag) {
      throw new EtagMismatchError();
    }
    const poolRows = await this.orgPoolRepo.list(actor.orgId);
    const poolIds = new Set(poolRows.map((r) => r.id));
    const seen = new Set<string>();
    const deduped: PutTemplatePair[] = [];
    for (const p of pairs) {
      if (seen.has(p.templateId)) continue;
      seen.add(p.templateId);
      deduped.push(p);
    }
    const invalidIds = deduped
      .map((p) => p.templateId)
      .filter((id) => !poolIds.has(id));
    if (invalidIds.length > 0) {
      throw new NotInOrgPoolError(invalidIds);
    }

    const beforeByTpl = new Map(before.map((b) => [b.templateId, b]));
    const afterByTpl = new Map(deduped.map((b) => [b.templateId, b]));
    const added = deduped
      .filter((b) => !beforeByTpl.has(b.templateId))
      .map((b) => b.templateId);
    const removed = before
      .filter((b) => !afterByTpl.has(b.templateId))
      .map((b) => b.templateId);
    const roleChanged: RoleChangeEntry[] = [];
    for (const b of deduped) {
      const prior = beforeByTpl.get(b.templateId);
      if (prior && prior.suggestedRole !== b.suggestedRole) {
        roleChanged.push({
          templateId: b.templateId,
          before: prior.suggestedRole,
          after: b.suggestedRole,
        });
      }
    }
    const noChange =
      added.length === 0 && removed.length === 0 && roleChanged.length === 0;

    if (!noChange) {
      await this.bindingsRepo.set(actor.orgId, actor.workspaceId, deduped);
      this.emitAudit({
        action: "workspace.templates_rebound",
        actor,
        targetId: actor.workspaceId,
        before: { ids: before.map((b) => b.templateId).slice().sort() },
        after: { ids: deduped.map((b) => b.templateId).slice().sort() },
        diff: { added, removed, roleChanged },
      });
    }

    return this.list(actor);
  }

  private emitAudit(params: {
    action: string;
    actor: WsActor;
    targetId: string;
    before: unknown;
    after: unknown;
    diff: unknown;
  }): void {
    const event: AuditEvent = {
      id: randomUUID(),
      ts: new Date().toISOString(),
      actor: { userId: params.actor.userId, orgId: params.actor.orgId },
      action: params.action,
      target: { kind: "workspace", id: params.targetId },
      before: params.before,
      after: { ...(params.after as object), diff: params.diff },
    };
    this.auditEmitter
      .emit(event)
      .catch((err) =>
        this.logger.warn({ err, action: params.action }, "audit_emit_failed"),
      );
  }
}
