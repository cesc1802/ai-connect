import { z } from "zod";
import type { GuardrailKind, GuardrailAction, GuardrailPolicy } from "llm-gateway";

/**
 * Single source of truth for the persisted guardrail policy shape. The HTTP
 * boundary validates writes against this schema; the gateway's runtime
 * `GuardrailPolicy` type (plain TS) is NOT re-declared by hand — the conformance
 * checks below fail to compile if the two ever drift apart.
 */

export const guardrailKindSchema = z.enum(["pii", "blocklist", "injection", "moderation"]);

export const guardrailActionSchema = z.enum(["redact", "block", "warn"]);

export const guardrailCheckConfigSchema = z.object({
  kind: guardrailKindSchema,
  enabled: z.boolean(),
  action: guardrailActionSchema,
  options: z.record(z.string(), z.unknown()).optional(),
});

export const guardrailPolicySchema = z.object({
  enabled: z.boolean(),
  checks: z.array(guardrailCheckConfigSchema),
});

export type GuardrailPolicyInput = z.infer<typeof guardrailPolicySchema>;

/**
 * Per-workspace policy persistence contract. The concrete Drizzle implementation
 * lives in the HTTP package (alongside the other repositories). `get` resolves
 * an absent row to a disabled, empty policy so callers never special-case null.
 */
export interface GuardrailPolicyRepository {
  get(workspaceId: string): Promise<GuardrailPolicy>;
  upsert(workspaceId: string, policy: GuardrailPolicy): Promise<void>;
}

// --- Compile-time conformance guards (erased at runtime) -------------------
// `true` only when the zod enum exactly equals the gateway string-literal union.
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

export type KindConforms = Equals<z.infer<typeof guardrailKindSchema>, GuardrailKind>;
export type ActionConforms = Equals<z.infer<typeof guardrailActionSchema>, GuardrailAction>;
// Every gateway policy is a valid parsed shape (guards required-field drift).
export type PolicyConforms = GuardrailPolicy extends GuardrailPolicyInput ? true : false;

const _kindConforms: KindConforms = true;
const _actionConforms: ActionConforms = true;
const _policyConforms: PolicyConforms = true;
void _kindConforms;
void _actionConforms;
void _policyConforms;
