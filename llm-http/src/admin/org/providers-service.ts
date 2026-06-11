import type { AuditEmitter, AuditEvent } from "@ai-connect/shared";
import { randomUUID } from "node:crypto";
import type { Logger } from "../../logger.js";
import { ApiKeyVault, lastFourOf } from "./api-key-vault.js";
import type {
  ProvidersRepository,
  StoredProvider,
} from "./providers-repo.js";
import type { ProviderKind } from "./provider-kind.js";

export interface WireProvider {
  id: string;
  displayName: string;
  providerKind: ProviderKind;
  isEnabled: boolean;
  hasKey: boolean;
  lastFour: string;
  baseUrl: string | null;
}

export interface ServiceActor {
  userId: string;
  orgId: string;
}

export interface AddProviderInput {
  displayName: string;
  providerKind: ProviderKind;
  apiKey: string;
  baseUrl?: string | undefined;
}

export interface UpdateProviderInput {
  displayName?: string | undefined;
  isEnabled?: boolean | undefined;
  baseUrl?: string | undefined;
}

export interface RotateKeyInput {
  apiKey: string;
}

export class ProviderDuplicateNameError extends Error {
  readonly code = "provider_duplicate_name";
  constructor(displayName: string) {
    super(`A provider named "${displayName}" already exists.`);
  }
}

export class ProviderNotFoundError extends Error {
  readonly code = "provider_not_found";
  constructor(id: string) {
    super(`Provider ${id} not found.`);
  }
}

export class ProviderInUseError extends Error {
  readonly code = "provider_in_use";
  constructor(id: string) {
    super(
      `Provider ${id} is referenced by one or more workspaces and cannot be deleted.`,
    );
  }
}

function toWire(stored: StoredProvider): WireProvider {
  return {
    id: stored.id,
    displayName: stored.displayName,
    providerKind: stored.providerKind,
    isEnabled: stored.isEnabled,
    hasKey: stored.encryptedKey.length > 0,
    lastFour: stored.lastFour,
    baseUrl: stored.baseUrl,
  };
}

function diffForUpdate(
  before: StoredProvider,
  after: StoredProvider,
): {
  before: Partial<WireProvider>;
  after: Partial<WireProvider>;
} {
  const beforeDiff: Partial<WireProvider> = {};
  const afterDiff: Partial<WireProvider> = {};
  if (before.displayName !== after.displayName) {
    beforeDiff.displayName = before.displayName;
    afterDiff.displayName = after.displayName;
  }
  if (before.isEnabled !== after.isEnabled) {
    beforeDiff.isEnabled = before.isEnabled;
    afterDiff.isEnabled = after.isEnabled;
  }
  if (before.baseUrl !== after.baseUrl) {
    beforeDiff.baseUrl = before.baseUrl;
    afterDiff.baseUrl = after.baseUrl;
  }
  return { before: beforeDiff, after: afterDiff };
}

export class OrgProvidersService {
  constructor(
    private readonly repo: ProvidersRepository,
    private readonly vault: ApiKeyVault,
    private readonly auditEmitter: AuditEmitter,
    private readonly logger: Logger,
  ) {}

  async list(orgId: string): Promise<WireProvider[]> {
    const rows = await this.repo.listByOrg(orgId);
    return rows.map(toWire);
  }

  async add(
    actor: ServiceActor,
    input: AddProviderInput,
  ): Promise<WireProvider> {
    const existing = await this.repo.findByOrgAndName(
      actor.orgId,
      input.displayName,
    );
    if (existing) throw new ProviderDuplicateNameError(input.displayName);

    // Key-less providers (e.g. ollama) store an empty ref; routes enforce
    // which kinds may omit the key.
    const encrypted = input.apiKey ? this.vault.encrypt(input.apiKey) : "";
    const stored = await this.repo.create({
      orgId: actor.orgId,
      displayName: input.displayName,
      providerKind: input.providerKind,
      encryptedKey: encrypted,
      lastFour: input.apiKey ? lastFourOf(input.apiKey) : "",
      baseUrl: input.baseUrl,
    });
    const wire = toWire(stored);
    this.emitAudit({
      action: "provider.created",
      actor,
      targetId: stored.id,
      after: wire,
    });
    return wire;
  }

  async update(
    actor: ServiceActor,
    providerId: string,
    input: UpdateProviderInput,
  ): Promise<WireProvider> {
    const before = await this.repo.findById(actor.orgId, providerId);
    if (!before) throw new ProviderNotFoundError(providerId);

    if (input.displayName && input.displayName !== before.displayName) {
      const clash = await this.repo.findByOrgAndName(
        actor.orgId,
        input.displayName,
      );
      if (clash && clash.id !== providerId) {
        throw new ProviderDuplicateNameError(input.displayName);
      }
    }

    const after = await this.repo.update(actor.orgId, providerId, input);
    const wire = toWire(after);
    const diff = diffForUpdate(before, after);
    this.emitAudit({
      action: "provider.updated",
      actor,
      targetId: providerId,
      before: diff.before,
      after: diff.after,
    });
    return wire;
  }

  async rotateKey(
    actor: ServiceActor,
    providerId: string,
    input: RotateKeyInput,
  ): Promise<WireProvider> {
    const before = await this.repo.findById(actor.orgId, providerId);
    if (!before) throw new ProviderNotFoundError(providerId);

    const encrypted = this.vault.encrypt(input.apiKey);
    const after = await this.repo.update(actor.orgId, providerId, {
      encryptedKey: encrypted,
      lastFour: lastFourOf(input.apiKey),
    });
    const wire = toWire(after);
    this.emitAudit({
      action: "provider.key_rotated",
      actor,
      targetId: providerId,
      before: { lastFour: before.lastFour },
      after: { lastFour: after.lastFour },
    });
    return wire;
  }

  async delete(actor: ServiceActor, providerId: string): Promise<void> {
    const before = await this.repo.findById(actor.orgId, providerId);
    if (!before) throw new ProviderNotFoundError(providerId);
    await this.repo.delete(actor.orgId, providerId);
    this.emitAudit({
      action: "provider.deleted",
      actor,
      targetId: providerId,
      before: toWire(before),
    });
  }

  private emitAudit(params: {
    action: string;
    actor: ServiceActor;
    targetId: string;
    before?: unknown;
    after?: unknown;
  }): void {
    const event: AuditEvent = {
      id: randomUUID(),
      ts: new Date().toISOString(),
      actor: { userId: params.actor.userId, orgId: params.actor.orgId },
      action: params.action,
      target: { kind: "provider", id: params.targetId },
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
