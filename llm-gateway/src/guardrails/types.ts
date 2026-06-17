import type { ChatRequest } from "../core/types.js";

/**
 * Guardrail engine contracts. Pure TypeScript only — no zod/runtime validation
 * lives here (the persisted policy is validated at the HTTP boundary and a test
 * asserts that schema stays assignable to `GuardrailPolicy`).
 */

export type GuardrailKind = "pii" | "blocklist" | "injection" | "moderation";

/**
 * What to do when a check fires. Span-based checks (pii/blocklist) default to
 * `redact`; classification checks (injection/moderation) have no locatable span
 * and so default to `block`. `warn` records the finding but passes the request.
 */
export type GuardrailAction = "redact" | "block" | "warn";

export type GuardrailSeverity = "low" | "medium" | "high";

/**
 * Where in the outbound request a finding was located. The scan surface is the
 * whole `ChatRequest`, not just message text — tool definitions, assistant
 * tool-call arguments, and the `user` field can all carry sensitive content.
 */
export type GuardrailChannel = "message" | "tool_def" | "tool_call_args" | "user";

export interface GuardrailFinding {
  checkId: string;
  kind: GuardrailKind;
  channel: GuardrailChannel;
  /** Message index for `message`/`tool_call_args`; tool index for `tool_def`. */
  messageIndex?: number;
  /** Disambiguates a block within multi-block message content. */
  blockIndex?: number;
  /** Character span within the located text; absent for classification checks. */
  start?: number;
  end?: number;
  /** A non-sensitive label (e.g. "email", "aws_secret_key") — never the match. */
  label: string;
  severity: GuardrailSeverity;
}

export interface GuardrailResult {
  findings: GuardrailFinding[];
  /** A redacting check returns the rewritten request; absent means no change. */
  transformedRequest?: ChatRequest;
  /**
   * Record the findings but do NOT block, even when the check's action is
   * `block`. Used for non-silent fail-open: a moderation outage passes the
   * request through while still emitting an auditable finding.
   */
  passThrough?: boolean;
}

export interface GuardrailCheck {
  id: string;
  kind: GuardrailKind;
  run(input: GuardrailInput): Promise<GuardrailResult>;
}

export interface ModerationVerdict {
  flagged: boolean;
  categories: string[];
  raw?: unknown;
}

/** Per-request seams injected by the caller; no wrapper "deps" type. */
export interface GuardrailRunOptions {
  moderate?: (text: string) => Promise<ModerationVerdict>;
  signal?: AbortSignal;
}

export interface GuardrailInput {
  request: ChatRequest;
  opts: GuardrailRunOptions;
}

export interface GuardrailCheckConfig {
  kind: GuardrailKind;
  enabled: boolean;
  action: GuardrailAction;
  /** Check-specific tuning (patterns, keywords, thresholds). */
  options?: Record<string, unknown>;
}

export interface GuardrailPolicy {
  enabled: boolean;
  checks: GuardrailCheckConfig[];
}

export interface GuardrailOutcome {
  request: ChatRequest;
  blocked: boolean;
  findings: GuardrailFinding[];
}

/** Builds a check instance from its config and the per-request seams. */
export type GuardrailCheckFactory = (
  config: GuardrailCheckConfig,
  opts: GuardrailRunOptions,
) => GuardrailCheck;

export type GuardrailCheckRegistry = Partial<
  Record<GuardrailKind, GuardrailCheckFactory>
>;
