import { describe, it, expect } from "vitest";
import type { ChatRequest } from "../../core/types.js";
import { createBlocklistCheck } from "../checks/blocklist-check.js";
import { createPiiRedactionCheck } from "../checks/pii-redaction-check.js";
import type { GuardrailCheckConfig } from "../types.js";

const cfg = (options?: Record<string, unknown>): GuardrailCheckConfig => ({
  kind: "blocklist",
  enabled: true,
  action: "redact",
  ...(options && { options }),
});

function run(content: string, options?: Record<string, unknown>) {
  const check = createBlocklistCheck(cfg(options));
  const request: ChatRequest = { model: "m", maxTokens: 10, messages: [{ role: "user", content }] };
  return check.run({ request, opts: {} });
}

function masked(result: { transformedRequest?: ChatRequest }): string {
  return result.transformedRequest!.messages[0]!.content as string;
}

describe("blocklist-check", () => {
  it("matches a literal term case-insensitively on word boundaries", async () => {
    const r = await run("the Secret project is named Secret", { terms: ["secret"] });
    expect(r.findings).toHaveLength(2);
    expect(masked(r)).toBe("the [BLOCKED] project is named [BLOCKED]");
  });

  it("does not match a literal term inside a larger word", async () => {
    const r = await run("secretary desk", { terms: ["secret"] });
    expect(r.findings).toHaveLength(0);
  });

  it("matches a configured regex pattern", async () => {
    const r = await run("ref ABC-1234 here", { patterns: ["[A-Z]{3}-\\d{4}"] });
    expect(r.findings).toHaveLength(1);
    expect(masked(r)).toBe("ref [BLOCKED] here");
  });

  it("skips an invalid regex without throwing and still applies valid ones", async () => {
    const r = await run("hit foo here", { patterns: ["(unclosed", "foo"] });
    expect(r.findings).toHaveLength(1);
    expect(masked(r)).toBe("hit [BLOCKED] here");
  });

  it("rejects an over-length pattern before matching", async () => {
    const longPattern = "a".repeat(201);
    const r = await run(`${"a".repeat(201)} text`, { patterns: [longPattern] });
    expect(r.findings).toHaveLength(0);
  });

  it("skips matching when a segment exceeds the input length cap", async () => {
    const huge = "x".repeat(100_001) + " needle";
    const r = await run(huge, { terms: ["needle"] });
    expect(r.findings).toHaveLength(0);
  });

  it("produces no transform when nothing matches", async () => {
    const r = await run("nothing here", { terms: ["absent"] });
    expect(r.findings).toHaveLength(0);
    expect(r.transformedRequest).toBeUndefined();
  });

  it("chains after PII redaction: blocklist sees the already-masked text", async () => {
    const request: ChatRequest = {
      model: "m",
      maxTokens: 10,
      messages: [{ role: "user", content: "mail a@b.com about projectX" }],
    };
    const pii = await createPiiRedactionCheck({ kind: "pii", enabled: true, action: "redact" }).run({ request, opts: {} });
    const afterPii = pii.transformedRequest!;
    const block = await createBlocklistCheck(cfg({ terms: ["projectX"] })).run({ request: afterPii, opts: {} });
    expect((block.transformedRequest!.messages[0]!.content as string)).toBe("mail [REDACTED:EMAIL] about [BLOCKED]");
  });
});
