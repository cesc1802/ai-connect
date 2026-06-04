import { randomUUID } from "node:crypto";
import type { AuditEmitter, AuditEvent } from "@ai-connect/shared";
import type { Logger } from "../../logger.js";
import type { OrgUserRow, OrgUsersRepository } from "./users-repo.js";

export class DuplicatePendingError extends Error {
  constructor(public readonly email: string) {
    super(`Pending invite already exists for ${email}`);
    this.name = "DuplicatePendingError";
  }
}

export class UserNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`User ${id} not found`);
    this.name = "UserNotFoundError";
  }
}

export interface OrgUsersService {
  list(orgId: string): Promise<OrgUserRow[]>;
  invite(orgId: string, actorId: string, email: string): Promise<OrgUserRow>;
  disable(orgId: string, actorId: string, id: string): Promise<OrgUserRow>;
}

export class DefaultOrgUsersService implements OrgUsersService {
  constructor(
    private readonly repo: OrgUsersRepository,
    private readonly auditEmitter: AuditEmitter,
    private readonly logger: Logger,
  ) {}

  async list(orgId: string): Promise<OrgUserRow[]> {
    return this.repo.listByOrg(orgId);
  }

  async invite(
    orgId: string,
    actorId: string,
    email: string,
  ): Promise<OrgUserRow> {
    const existing = await this.repo.findByEmail(orgId, email);
    if (existing && existing.status === "pending") {
      throw new DuplicatePendingError(email);
    }
    const row = await this.repo.create(orgId, {
      email,
      status: "pending",
      joinedAt: new Date().toISOString(),
    });
    this.emit({
      action: "user.invited",
      actor: { userId: actorId, orgId },
      target: { kind: "user", id: row.id },
      after: row,
    });
    return row;
  }

  async disable(
    orgId: string,
    actorId: string,
    id: string,
  ): Promise<OrgUserRow> {
    const before = await this.repo.findById(orgId, id);
    if (!before) throw new UserNotFoundError(id);
    const snapshot = { ...before };
    const after = await this.repo.setStatus(orgId, id, "disabled");
    if (!after) throw new UserNotFoundError(id);
    this.emit({
      action: "user.disabled",
      actor: { userId: actorId, orgId },
      target: { kind: "user", id },
      before: snapshot,
      after: { ...after },
    });
    return after;
  }

  private emit(
    partial: Omit<AuditEvent, "id" | "ts">,
  ): void {
    const event: AuditEvent = {
      id: randomUUID(),
      ts: new Date().toISOString(),
      ...partial,
    };
    void this.auditEmitter.emit(event).catch((err) => {
      try {
        this.logger.warn({ err }, "audit_emit_failed");
      } catch {
        // Swallow: logger broken, nothing we can do.
      }
    });
  }
}
