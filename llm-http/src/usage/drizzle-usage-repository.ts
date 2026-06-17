import { sql, inArray } from "drizzle-orm";
import { usageMetrics, type DbClient } from "@ai-connect/db";
import type {
  NewUsageRecord,
  ProviderUsage,
  UsageRepository,
  UsageScope,
  WorkspaceUsage,
} from "@ai-connect/shared";

/** pg SUM returns string|null; coalesce to a finite number. */
function num(value: string | number | null): number {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return Number.isFinite(n) ? n : 0;
}

export class DrizzleUsageRepository implements UsageRepository {
  constructor(private readonly client: DbClient) {}

  async record(input: NewUsageRecord): Promise<void> {
    await this.client.db.insert(usageMetrics).values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      providerId: input.providerId ?? null,
      conversationId: input.conversationId ?? null,
      providerKind: input.providerKind,
      model: input.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      latencyMs: input.latencyMs,
    });
  }

  async aggregateByProvider(scope: UsageScope): Promise<ProviderUsage[]> {
    const rows = await this.client.db
      .select({
        providerId: usageMetrics.providerId,
        providerKind: usageMetrics.providerKind,
        inputTokens: sql<string>`sum(${usageMetrics.promptTokens})`,
        outputTokens: sql<string>`sum(${usageMetrics.completionTokens})`,
        requestCount: sql<string>`count(*)`,
      })
      .from(usageMetrics)
      .where(scopeFilter(scope))
      .groupBy(usageMetrics.providerId, usageMetrics.providerKind);

    return rows.map((r) => {
      const inputTokens = num(r.inputTokens);
      const outputTokens = num(r.outputTokens);
      return {
        providerId: r.providerId,
        providerKind: r.providerKind,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        requestCount: num(r.requestCount),
      };
    });
  }

  async aggregateByWorkspace(scope: UsageScope): Promise<WorkspaceUsage[]> {
    const rows = await this.client.db
      .select({
        workspaceId: usageMetrics.workspaceId,
        inputTokens: sql<string>`sum(${usageMetrics.promptTokens})`,
        outputTokens: sql<string>`sum(${usageMetrics.completionTokens})`,
        requestCount: sql<string>`count(*)`,
      })
      .from(usageMetrics)
      .where(scopeFilter(scope))
      .groupBy(usageMetrics.workspaceId);

    return rows.map((r) => {
      const inputTokens = num(r.inputTokens);
      const outputTokens = num(r.outputTokens);
      return {
        workspaceId: r.workspaceId,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        requestCount: num(r.requestCount),
      };
    });
  }
}

/**
 * "all" → no filter (org-wide). A list → restrict to those workspaces. An empty
 * list yields a never-true predicate so a member with no workspaces sees nothing
 * (inArray over [] would be invalid SQL, so short-circuit to false).
 */
function scopeFilter(scope: UsageScope) {
  if (scope === "all") return undefined;
  if (scope.length === 0) return sql`false`;
  return inArray(usageMetrics.workspaceId, scope);
}
