import { createHash, randomUUID } from "node:crypto";
import type { AuditEmitter, AuditEvent } from "@ai-connect/shared";
import type { Logger } from "../../logger.js";
import type { ProvidersRepository } from "../org/providers-repo.js";
import type { WsProviderBindingsRepo } from "./ws-providers-repo.js";
import type { ProviderKind } from "../org/provider-kind.js";

export interface WireWsProvider {
  id: string;
  displayName: string;
  providerKind: ProviderKind;
}

export interface WsProviderListResponse {
  available: WireWsProvider[];
  bound: WireWsProvider[];
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
    super(`Provider ids not in org pool: ${invalidIds.join(", ")}`);
  }
}

export class EtagMismatchError extends Error {
  readonly code = "etag_mismatch";
  constructor() {
    super("Binding set has changed; refetch and retry.");
  }
}

export function computeProvidersEtag(ids: readonly string[]): string {
  const payload = [...ids].sort().join(",");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export class WsProvidersService {
  constructor(
    private readonly bindingsRepo: WsProviderBindingsRepo,
    private readonly orgPoolRepo: ProvidersRepository,
    private readonly auditEmitter: AuditEmitter,
    private readonly logger: Logger,
  ) {}

  async list(actor: WsActor): Promise<WsProviderListResponse> {
    const poolRows = await this.orgPoolRepo.listByOrg(actor.orgId);
    const poolIndex = new Map(poolRows.map((r) => [r.id, r]));
    const storedIds = await this.bindingsRepo.get(actor.orgId, actor.workspaceId);
    const validBoundIds = storedIds.filter((id) => poolIndex.has(id));
    const boundSet = new Set(validBoundIds);
    const bound: WireWsProvider[] = validBoundIds
      .map((id) => poolIndex.get(id)!)
      .map((r) => ({
        id: r.id,
        displayName: r.displayName,
        providerKind: r.providerKind,
      }));
    const available: WireWsProvider[] = poolRows
      .filter((r) => !boundSet.has(r.id))
      .map((r) => ({
        id: r.id,
        displayName: r.displayName,
        providerKind: r.providerKind,
      }));
    return {
      available,
      bound,
      etag: computeProvidersEtag(validBoundIds),
    };
  }

  async replace(
    actor: WsActor,
    providerIds: string[],
    ifMatch: string | null,
  ): Promise<WsProviderListResponse> {
    const beforeIds = (await this.bindingsRepo.get(actor.orgId, actor.workspaceId))
      .slice();
    const currentEtag = computeProvidersEtag(beforeIds);
    if (ifMatch !== null && ifMatch !== currentEtag) {
      throw new EtagMismatchError();
    }
    const poolRows = await this.orgPoolRepo.listByOrg(actor.orgId);
    const poolIds = new Set(poolRows.map((r) => r.id));
    const deduped = Array.from(new Set(providerIds));
    const invalidIds = deduped.filter((id) => !poolIds.has(id));
    if (invalidIds.length > 0) {
      throw new NotInOrgPoolError(invalidIds);
    }

    const beforeSet = new Set(beforeIds);
    const afterSet = new Set(deduped);
    const added = deduped.filter((id) => !beforeSet.has(id));
    const removed = beforeIds.filter((id) => !afterSet.has(id));
    const noChange = added.length === 0 && removed.length === 0;

    if (!noChange) {
      await this.bindingsRepo.set(actor.orgId, actor.workspaceId, deduped);
      this.emitAudit({
        action: "workspace.providers_rebound",
        actor,
        targetId: actor.workspaceId,
        before: { ids: beforeIds.slice().sort() },
        after: { ids: deduped.slice().sort() },
        diff: { added, removed },
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
