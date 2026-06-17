import { api } from "./api";

// Thin typed wrappers over /workspaces/:id/guardrails. The policy shape mirrors
// the shared zod schema (kinds/actions); GET resolves an absent policy to a
// disabled, empty one server-side, so callers never special-case null.

export type GuardrailKind = "pii" | "blocklist" | "injection" | "moderation";
export type GuardrailAction = "redact" | "block" | "warn";

export interface GuardrailCheckConfig {
  kind: GuardrailKind;
  enabled: boolean;
  action: GuardrailAction;
  options?: Record<string, unknown>;
}

export interface GuardrailPolicy {
  enabled: boolean;
  checks: GuardrailCheckConfig[];
}

export function getGuardrailPolicy(workspaceId: string): Promise<GuardrailPolicy> {
  return api.get<GuardrailPolicy>(`/workspaces/${encodeURIComponent(workspaceId)}/guardrails`);
}

export function saveGuardrailPolicy(
  workspaceId: string,
  policy: GuardrailPolicy,
): Promise<GuardrailPolicy> {
  return api.put<GuardrailPolicy>(
    `/workspaces/${encodeURIComponent(workspaceId)}/guardrails`,
    policy,
  );
}
