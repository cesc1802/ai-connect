import type { ChatRequest } from "../core/types.js";
import { GuardrailBlockedError } from "../core/errors.js";
import type {
  GuardrailCheckRegistry,
  GuardrailFinding,
  GuardrailOutcome,
  GuardrailPolicy,
  GuardrailRunOptions,
} from "./types.js";
import { DEFAULT_CHECK_REGISTRY } from "./checks/index.js";

/**
 * Run an ordered guardrail pipeline over an outbound request and apply each
 * check's action. Pure: no DB/HTTP coupling, no mutation of the input request.
 *
 * - Disabled or absent policy → passthrough (zero overhead, no error).
 * - Checks run sequentially over the *current* request, so a later check sees
 *   the redactions an earlier one applied.
 * - `redact` → swap in the check's transformed request and continue.
 * - `block`  → stop immediately and set `blocked`.
 * - `warn`   → record findings only.
 *
 * Caller decides what to do with a blocked outcome; `assertNotBlocked` turns it
 * into a `GuardrailBlockedError` for the SDK opt-in path.
 */
export async function runGuardrails(
  request: ChatRequest,
  policy: GuardrailPolicy | undefined,
  opts: GuardrailRunOptions = {},
  registry: GuardrailCheckRegistry = DEFAULT_CHECK_REGISTRY,
): Promise<GuardrailOutcome> {
  if (!policy?.enabled) {
    return { request, blocked: false, findings: [] };
  }

  let current = request;
  const findings: GuardrailFinding[] = [];

  for (const config of policy.checks) {
    if (!config.enabled) continue;
    const factory = registry[config.kind];
    if (!factory) continue; // Unknown/not-yet-registered kind: skip, never crash.

    const check = factory(config, opts);
    const result = await check.run({ request: current, opts });
    findings.push(...result.findings);

    if (result.findings.length === 0) continue;

    // `passThrough` lets a block-action check record findings without blocking
    // (non-silent fail-open, e.g. a moderation outage).
    if (config.action === "block" && !result.passThrough) {
      return { request: current, blocked: true, findings };
    }
    if (config.action === "redact" && result.transformedRequest) {
      current = result.transformedRequest;
    }
    // `warn` (or a redact check that produced no transform): keep going.
  }

  return { request: current, blocked: false, findings };
}

/** Summaries safe to attach to the block error — kind/label/severity only. */
export function findingSummaries(findings: GuardrailFinding[]) {
  return findings.map((f) => ({ kind: f.kind, label: f.label, severity: f.severity }));
}

/**
 * Convenience for the SDK opt-in path: run guardrails and throw on block,
 * otherwise return the (possibly redacted) request.
 */
export async function applyGuardrails(
  request: ChatRequest,
  policy: GuardrailPolicy | undefined,
  opts: GuardrailRunOptions = {},
  registry: GuardrailCheckRegistry = DEFAULT_CHECK_REGISTRY,
): Promise<ChatRequest> {
  const outcome = await runGuardrails(request, policy, opts, registry);
  if (outcome.blocked) {
    throw new GuardrailBlockedError(findingSummaries(outcome.findings));
  }
  return outcome.request;
}
