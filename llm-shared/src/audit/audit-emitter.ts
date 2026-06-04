import type { AuditEvent } from "./audit-event.js";

export interface AuditEmitter {
  emit(event: AuditEvent): Promise<void>;
}
