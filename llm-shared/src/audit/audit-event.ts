export type AuditTargetKind =
  | "org"
  | "workspace"
  | "user"
  | "provider"
  | "provider-binding"
  | "template"
  | "role"
  | "quota";

export interface AuditActor {
  userId: string;
  orgId: string;
}

export interface AuditTarget {
  kind: AuditTargetKind;
  id: string;
}

export interface AuditEvent {
  id: string;
  ts: string;
  actor: AuditActor;
  action: string;
  target: AuditTarget;
  before?: unknown;
  after?: unknown;
}
