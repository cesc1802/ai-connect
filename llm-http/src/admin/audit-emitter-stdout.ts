import type { AuditEmitter, AuditEvent } from "@ai-connect/shared";
import type { Logger } from "../logger.js";

// Stdout adapter wraps logger.info; we never let an audit write crash the caller's path.
// The primary write must succeed even if the audit pipeline is offline (BR-096).
export class StdoutAuditEmitter implements AuditEmitter {
  constructor(private readonly logger: Logger) {}

  async emit(event: AuditEvent): Promise<void> {
    try {
      this.logger.info({ audit: event }, "audit_event");
    } catch (err) {
      try {
        this.logger.warn({ err }, "audit_emit_failed");
      } catch {
        // Swallow: logger itself is broken — nothing useful we can do without re-throwing.
      }
    }
  }
}
