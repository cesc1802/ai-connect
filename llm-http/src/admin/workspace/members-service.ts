import { randomUUID } from "node:crypto";
import type {
  AuditEmitter,
  AuditEvent,
  WorkspaceRole,
} from "@ai-connect/shared";
import type { Logger } from "../../logger.js";
import type { WsMemberRow, WsMembersRepository } from "./members-repo.js";

export const LAST_ADMIN_CODE = "last_admin" as const;

export class DuplicateMemberError extends Error {
  constructor(public readonly email: string) {
    super(`Member already exists for ${email}`);
    this.name = "DuplicateMemberError";
  }
}

export class MemberNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Member ${id} not found`);
    this.name = "MemberNotFoundError";
  }
}

export class LastAdminError extends Error {
  constructor() {
    super("Workspace must retain at least one admin");
    this.name = "LastAdminError";
  }
}

export interface InviteInput {
  email: string;
  role: WorkspaceRole;
}

export interface WsMembersService {
  list(wsId: string): Promise<WsMemberRow[]>;
  invite(
    wsId: string,
    actorId: string,
    input: InviteInput,
  ): Promise<WsMemberRow>;
  changeRole(
    wsId: string,
    actorId: string,
    id: string,
    role: WorkspaceRole,
  ): Promise<WsMemberRow>;
  remove(wsId: string, actorId: string, id: string): Promise<WsMemberRow>;
}

export class DefaultWsMembersService implements WsMembersService {
  constructor(
    private readonly repo: WsMembersRepository,
    private readonly auditEmitter: AuditEmitter,
    private readonly logger: Logger,
  ) {}

  async list(wsId: string): Promise<WsMemberRow[]> {
    return this.repo.listByWs(wsId);
  }

  async invite(
    wsId: string,
    actorId: string,
    input: InviteInput,
  ): Promise<WsMemberRow> {
    const existing = await this.repo.findByEmail(wsId, input.email);
    if (existing) throw new DuplicateMemberError(input.email);
    const row = await this.repo.create(wsId, {
      email: input.email,
      role: input.role,
      joinedAt: new Date().toISOString(),
    });
    this.emit({
      action: "member.invited",
      actor: { userId: actorId, orgId: wsId },
      target: { kind: "user", id: row.id },
      after: { ...row },
    });
    return row;
  }

  async changeRole(
    wsId: string,
    actorId: string,
    id: string,
    role: WorkspaceRole,
  ): Promise<WsMemberRow> {
    const before = await this.repo.findById(wsId, id);
    if (!before) throw new MemberNotFoundError(id);
    if (before.role === role) return before;

    if (before.role === "admin" && role !== "admin") {
      const admins = await this.repo.countAdmins(wsId);
      if (admins <= 1) throw new LastAdminError();
    }

    const snapshot = { ...before };
    const after = await this.repo.setRole(wsId, id, role);
    if (!after) throw new MemberNotFoundError(id);
    this.emit({
      action: "member.role_changed",
      actor: { userId: actorId, orgId: wsId },
      target: { kind: "user", id },
      before: snapshot,
      after: { ...after },
    });
    return after;
  }

  async remove(
    wsId: string,
    actorId: string,
    id: string,
  ): Promise<WsMemberRow> {
    const before = await this.repo.findById(wsId, id);
    if (!before) throw new MemberNotFoundError(id);

    if (before.role === "admin") {
      const admins = await this.repo.countAdmins(wsId);
      if (admins <= 1) throw new LastAdminError();
    }

    const removed = await this.repo.remove(wsId, id);
    if (!removed) throw new MemberNotFoundError(id);
    this.emit({
      action: "member.removed",
      actor: { userId: actorId, orgId: wsId },
      target: { kind: "user", id },
      before: { ...before },
    });
    return removed;
  }

  private emit(partial: Omit<AuditEvent, "id" | "ts">): void {
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
