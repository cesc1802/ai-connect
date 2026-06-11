import { describe, it, expect, vi } from "vitest";
import { StdoutAuditEmitter } from "./audit-emitter-stdout.js";
import type { AuditEvent } from "@ai-connect/shared";
import type { Logger } from "../logger.js";

function makeLogger(overrides: Partial<Logger> = {}): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    ...overrides,
  } as unknown as Logger;
}

function sampleEvent(): AuditEvent {
  return {
    id: "evt-1",
    ts: new Date().toISOString(),
    actor: { userId: "u-1", orgId: "org-1" },
    action: "user.invited",
    target: { kind: "user", id: "u-2" },
  };
}

describe("StdoutAuditEmitter", () => {
  it("emits via logger.info", async () => {
    const logger = makeLogger();
    const emitter = new StdoutAuditEmitter(logger);
    const event = sampleEvent();

    await emitter.emit(event);

    expect(logger.info).toHaveBeenCalledWith({ audit: event }, "audit_event");
  });

  it("does not throw when logger.info throws", async () => {
    const logger = makeLogger({
      info: vi.fn(() => {
        throw new Error("logger exploded");
      }),
    });
    const emitter = new StdoutAuditEmitter(logger);

    await expect(emitter.emit(sampleEvent())).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("does not throw when both info and warn throw", async () => {
    const logger = makeLogger({
      info: vi.fn(() => {
        throw new Error("info broken");
      }),
      warn: vi.fn(() => {
        throw new Error("warn broken");
      }),
    });
    const emitter = new StdoutAuditEmitter(logger);

    await expect(emitter.emit(sampleEvent())).resolves.toBeUndefined();
  });
});
