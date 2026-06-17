import { describe, it, expect } from "vitest";
import type { ChatRequest } from "../../core/types.js";
import { createModerationCheck } from "../checks/moderation-check.js";
import type { GuardrailCheckConfig, ModerationVerdict } from "../types.js";

const cfg = (options?: Record<string, unknown>): GuardrailCheckConfig => ({
  kind: "moderation",
  enabled: true,
  action: "block",
  ...(options && { options }),
});

const req: ChatRequest = { model: "m", maxTokens: 10, messages: [{ role: "user", content: "some content" }] };

describe("moderation-check", () => {
  it("is inert when no moderate callback is injected", async () => {
    const r = await createModerationCheck(cfg()).run({ request: req, opts: {} });
    expect(r.findings).toHaveLength(0);
  });

  it("passes clean content (not flagged)", async () => {
    const moderate = async (): Promise<ModerationVerdict> => ({ flagged: false, categories: [] });
    const r = await createModerationCheck(cfg()).run({ request: req, opts: { moderate } });
    expect(r.findings).toHaveLength(0);
  });

  it("emits a finding per flagged category", async () => {
    const moderate = async (): Promise<ModerationVerdict> => ({ flagged: true, categories: ["hate", "violence"] });
    const r = await createModerationCheck(cfg()).run({ request: req, opts: { moderate } });
    expect(r.findings.map((f) => f.label)).toEqual(["moderation:hate", "moderation:violence"]);
    expect(r.passThrough).toBeFalsy();
  });

  it("filters to allowed categories when configured", async () => {
    const moderate = async (): Promise<ModerationVerdict> => ({ flagged: true, categories: ["spam", "hate"] });
    const r = await createModerationCheck(cfg({ categories: ["hate"] })).run({ request: req, opts: { moderate } });
    expect(r.findings.map((f) => f.label)).toEqual(["moderation:hate"]);
  });

  it("fail-open on moderate throw: passes through but records moderation_unavailable", async () => {
    const moderate = async (): Promise<ModerationVerdict> => {
      throw new Error("moderation endpoint down");
    };
    const r = await createModerationCheck(cfg()).run({ request: req, opts: { moderate } });
    expect(r.passThrough).toBe(true);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]!.label).toBe("moderation_unavailable");
  });

  it("fail-closed on moderate throw: blocks (finding, no passThrough)", async () => {
    const moderate = async (): Promise<ModerationVerdict> => {
      throw new Error("moderation endpoint down");
    };
    const r = await createModerationCheck(cfg({ failClosed: true })).run({ request: req, opts: { moderate } });
    expect(r.passThrough).toBeFalsy();
    expect(r.findings[0]!.label).toBe("moderation_unavailable");
    expect(r.findings[0]!.severity).toBe("high");
  });

  it("never echoes moderated content in findings", async () => {
    const moderate = async (): Promise<ModerationVerdict> => ({ flagged: true, categories: ["hate"] });
    const secret: ChatRequest = { model: "m", maxTokens: 10, messages: [{ role: "user", content: "SENSITIVE-PAYLOAD-XYZ" }] };
    const r = await createModerationCheck(cfg()).run({ request: secret, opts: { moderate } });
    expect(JSON.stringify(r.findings)).not.toContain("SENSITIVE-PAYLOAD-XYZ");
  });
});
