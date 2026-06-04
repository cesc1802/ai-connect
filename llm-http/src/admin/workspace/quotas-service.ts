import { randomUUID } from "node:crypto";
import type {
  AuditEmitter,
  AuditEvent,
  WorkspaceRole,
} from "@ai-connect/shared";
import type { Logger } from "../../logger.js";
import type { StoredRoleQuota, WsQuotasRepo } from "./quotas-repo.js";

export interface WireRoleQuota {
  role: WorkspaceRole;
  maxRequests: number;
  overCount: number;
}

export interface QuotaWarning {
  role: WorkspaceRole;
  overCount: number;
}

export interface QuotasListResponse {
  rows: WireRoleQuota[];
}

export interface QuotasPatchResponse {
  rows: WireRoleQuota[];
  warnings?: QuotaWarning[];
}

export interface QuotasPatchRow {
  role: WorkspaceRole;
  maxRequests: number;
}

export interface WsActor {
  userId: string;
  orgId: string;
  workspaceId: string;
}

// In-memory usage counter is a placeholder until chat-flow integration writes
// per-role rolling counters. Live counter wiring lands with the chat integration.
export interface UsageCounter {
  current(
    orgId: string,
    workspaceId: string,
    role: WorkspaceRole,
  ): Promise<number>;
}

export class StubUsageCounter implements UsageCounter {
  async current(): Promise<number> {
    return 0;
  }
}

export class WsQuotasService {
  constructor(
    private readonly repo: WsQuotasRepo,
    private readonly usage: UsageCounter,
    private readonly auditEmitter: AuditEmitter,
    private readonly logger: Logger,
  ) {}

  async list(actor: WsActor): Promise<QuotasListResponse> {
    const stored = await this.repo.get(actor.orgId, actor.workspaceId);
    const rows: WireRoleQuota[] = [];
    for (const r of stored) {
      const overCount = await this.usage.current(
        actor.orgId,
        actor.workspaceId,
        r.role,
      );
      rows.push({ role: r.role, maxRequests: r.maxRequests, overCount });
    }
    return { rows };
  }

  async patch(
    actor: WsActor,
    incoming: QuotasPatchRow[],
    force: boolean,
  ): Promise<QuotasPatchResponse> {
    const before = await this.repo.get(actor.orgId, actor.workspaceId);
    const beforeByRole = new Map(before.map((r) => [r.role, r]));
    const merged: StoredRoleQuota[] = before.map((r) => ({ ...r }));
    const mergedByRole = new Map(merged.map((r) => [r.role, r] as const));
    for (const incomingRow of incoming) {
      const existing = mergedByRole.get(incomingRow.role);
      if (existing) {
        existing.maxRequests = incomingRow.maxRequests;
      } else {
        const fresh: StoredRoleQuota = {
          role: incomingRow.role,
          maxRequests: incomingRow.maxRequests,
        };
        merged.push(fresh);
        mergedByRole.set(incomingRow.role, fresh);
      }
    }

    const warnings: QuotaWarning[] = [];
    for (const r of incoming) {
      const overCount = await this.usage.current(
        actor.orgId,
        actor.workspaceId,
        r.role,
      );
      if (overCount > r.maxRequests) {
        warnings.push({ role: r.role, overCount });
      }
    }

    if (warnings.length > 0 && !force) {
      return { rows: await this.materialize(actor, merged), warnings };
    }

    await this.repo.set(actor.orgId, actor.workspaceId, merged);
    const diff = incoming
      .map((r) => {
        const prior = beforeByRole.get(r.role)?.maxRequests ?? null;
        return prior !== r.maxRequests
          ? { role: r.role, before: prior, after: r.maxRequests }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (diff.length > 0) {
      this.emitAudit({
        action: "workspace.quotas_updated",
        actor,
        targetId: actor.workspaceId,
        before: { rows: before },
        after: { rows: merged, diff, forced: force && warnings.length > 0 },
      });
    }

    return { rows: await this.materialize(actor, merged) };
  }

  private async materialize(
    actor: WsActor,
    stored: StoredRoleQuota[],
  ): Promise<WireRoleQuota[]> {
    const out: WireRoleQuota[] = [];
    for (const r of stored) {
      const overCount = await this.usage.current(
        actor.orgId,
        actor.workspaceId,
        r.role,
      );
      out.push({ role: r.role, maxRequests: r.maxRequests, overCount });
    }
    return out;
  }

  private emitAudit(params: {
    action: string;
    actor: WsActor;
    targetId: string;
    before: unknown;
    after: unknown;
  }): void {
    const event: AuditEvent = {
      id: randomUUID(),
      ts: new Date().toISOString(),
      actor: { userId: params.actor.userId, orgId: params.actor.orgId },
      action: params.action,
      target: { kind: "workspace", id: params.targetId },
      before: params.before,
      after: params.after,
    };
    this.auditEmitter
      .emit(event)
      .catch((err) =>
        this.logger.warn({ err, action: params.action }, "audit_emit_failed"),
      );
  }
}
