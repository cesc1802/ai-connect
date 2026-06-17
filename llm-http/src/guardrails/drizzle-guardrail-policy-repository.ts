import { eq } from "drizzle-orm";
import { workspaceGuardrailPolicies, type DbClient } from "@ai-connect/db";
import type { GuardrailPolicyRepository } from "@ai-connect/shared";
import type { GuardrailPolicy } from "llm-gateway";

/**
 * Per-workspace guardrail policy persistence. One row per workspace (PK on
 * workspaceId); an absent row resolves to a disabled, empty policy so callers
 * never special-case null. `checks` is stored as JSONB and round-trips as the
 * gateway's `GuardrailCheckConfig[]` — validated by the shared zod schema at the
 * HTTP boundary before it reaches here.
 */
export class DrizzleGuardrailPolicyRepository implements GuardrailPolicyRepository {
  constructor(private readonly client: DbClient) {}

  async get(workspaceId: string): Promise<GuardrailPolicy> {
    const [row] = await this.client.db
      .select({
        enabled: workspaceGuardrailPolicies.enabled,
        checks: workspaceGuardrailPolicies.checks,
      })
      .from(workspaceGuardrailPolicies)
      .where(eq(workspaceGuardrailPolicies.workspaceId, workspaceId))
      .limit(1);

    if (!row) return { enabled: false, checks: [] };
    return { enabled: row.enabled, checks: row.checks as GuardrailPolicy["checks"] };
  }

  async upsert(workspaceId: string, policy: GuardrailPolicy): Promise<void> {
    await this.client.db
      .insert(workspaceGuardrailPolicies)
      .values({ workspaceId, enabled: policy.enabled, checks: policy.checks })
      .onConflictDoUpdate({
        target: workspaceGuardrailPolicies.workspaceId,
        set: { enabled: policy.enabled, checks: policy.checks, updatedAt: new Date() },
      });
  }
}
