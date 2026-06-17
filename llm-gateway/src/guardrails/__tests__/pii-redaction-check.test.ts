import { describe, it, expect } from "vitest";
import type { ChatRequest } from "../../core/types.js";
import { createPiiRedactionCheck } from "../checks/pii-redaction-check.js";
import type { GuardrailCheckConfig } from "../types.js";

const cfg = (options?: Record<string, unknown>): GuardrailCheckConfig => ({
  kind: "pii",
  enabled: true,
  action: "redact",
  ...(options && { options }),
});

function run(content: string, options?: Record<string, unknown>) {
  const check = createPiiRedactionCheck(cfg(options));
  const request: ChatRequest = { model: "m", maxTokens: 10, messages: [{ role: "user", content }] };
  return check.run({ request, opts: {} });
}

function maskedContent(result: { transformedRequest?: ChatRequest }): string {
  const c = result.transformedRequest!.messages[0]!.content;
  return typeof c === "string" ? c : JSON.stringify(c);
}

describe("pii-redaction-check detectors", () => {
  it("detects and masks an email with the EMAIL label", async () => {
    const r = await run("contact me at jane.doe@example.com please");
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]!.label).toBe("email");
    expect(maskedContent(r)).toBe("contact me at [REDACTED:EMAIL] please");
  });

  it("detects an openai-style key and an AWS access key", async () => {
    const r = await run("key sk-abcdefghijklmnopqrstuvwx and AKIAIOSFODNN7EXAMPLE end");
    const labels = r.findings.map((f) => f.label).sort();
    expect(labels).toContain("openai_key");
    expect(labels).toContain("aws_access_key");
    expect(maskedContent(r)).toContain("[REDACTED:OPENAI_KEY]");
    expect(maskedContent(r)).toContain("[REDACTED:AWS_ACCESS_KEY]");
  });

  it("masks a Luhn-valid credit card but ignores an invalid 16-digit number", async () => {
    const valid = await run("card 4111 1111 1111 1111 ok");
    expect(valid.findings.some((f) => f.label === "credit_card")).toBe(true);

    const invalid = await run("number 1234 5678 9012 3456 ok");
    expect(invalid.findings.some((f) => f.label === "credit_card")).toBe(false);
  });

  it("detects an IPv4 address", async () => {
    const r = await run("server at 192.168.1.100 listening");
    expect(r.findings.some((f) => f.label === "ipv4")).toBe(true);
  });

  it("produces no finding and no transform for clean text", async () => {
    const r = await run("just a normal sentence with no secrets");
    expect(r.findings).toHaveLength(0);
    expect(r.transformedRequest).toBeUndefined();
  });

  it("never includes the raw matched value in findings", async () => {
    const r = await run("email jane.doe@example.com");
    expect(JSON.stringify(r.findings)).not.toContain("jane.doe@example.com");
  });

  it("honors the detectors option (only the selected detector runs)", async () => {
    const r = await run("email a@b.com and ip 10.0.0.1", { detectors: ["email"] });
    const labels = r.findings.map((f) => f.label);
    expect(labels).toEqual(["email"]);
  });

  it("scans tool defs, tool-call args, and the user field — not just message text", async () => {
    const request: ChatRequest = {
      model: "m",
      maxTokens: 10,
      user: "ip 8.8.8.8",
      messages: [
        // assistant tool-call carried at runtime
        {
          role: "assistant",
          content: "",
          // @ts-expect-error runtime-only field
          toolCalls: [{ function: { arguments: '{"email":"x@y.com"}' } }],
        },
      ],
      tools: [
        { type: "function", function: { name: "t", description: "mail me at z@w.com", parameters: { type: "object" } } },
      ],
    };
    const check = createPiiRedactionCheck(cfg());
    const r = await check.run({ request, opts: {} });
    const channels = new Set(r.findings.map((f) => f.channel));
    expect(channels.has("user")).toBe(true);
    expect(channels.has("tool_def")).toBe(true);
    expect(channels.has("tool_call_args")).toBe(true);
  });
});
