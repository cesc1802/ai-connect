import type { ChatRequest, ProviderName } from "../../core/index.js";
import type { IRoutingStrategy, ProviderInfo } from "../routing-strategy.js";

/**
 * Provider cost configuration
 */
export interface ProviderCost {
  inputTokenCost: number; // Cost per 1K input tokens
  outputTokenCost: number; // Cost per 1K output tokens
}

/**
 * Cost-based strategy prefers cheaper providers
 */
export class CostBasedStrategy implements IRoutingStrategy {
  readonly name = "cost-based";

  private readonly costs: Map<ProviderName, ProviderCost>;

  constructor(costs: Partial<Record<ProviderName, ProviderCost>>) {
    this.costs = new Map(Object.entries(costs) as [ProviderName, ProviderCost][]);
  }

  select(request: ChatRequest, providers: ProviderInfo[]): ProviderName | null {
    if (providers.length === 0) {
      return null;
    }

    // Filter to healthy providers
    const healthy = providers.filter((p) => p.healthy);
    if (healthy.length === 0) {
      return null;
    }

    // Sort by cost (input + output estimate)
    // Estimate output tokens as maxTokens
    const estimatedInput = this.estimateInputTokens(request);
    const estimatedOutput = request.maxTokens;

    let cheapest: ProviderInfo | null = null;
    let lowestCost = Infinity;

    for (const info of healthy) {
      const cost = this.costs.get(info.name);
      if (!cost) {
        // No cost info, skip or use high default
        continue;
      }

      const totalCost =
        (estimatedInput / 1000) * cost.inputTokenCost +
        (estimatedOutput / 1000) * cost.outputTokenCost;

      if (totalCost < lowestCost) {
        lowestCost = totalCost;
        cheapest = info;
      }
    }

    // If no cost info available, return first healthy
    return cheapest?.name ?? healthy[0]?.name ?? null;
  }

  /**
   * Rough estimate of input tokens from messages
   * ~4 chars per token on average
   */
  private estimateInputTokens(request: ChatRequest): number {
    let charCount = 0;
    for (const msg of request.messages) {
      if (typeof msg.content === "string") {
        charCount += msg.content.length;
      } else {
        for (const block of msg.content) {
          if (block.type === "text") {
            charCount += block.text.length;
          }
        }
      }
    }
    return Math.ceil(charCount / 4);
  }

  /**
   * Update cost for a provider
   */
  setCost(provider: ProviderName, cost: ProviderCost): void {
    this.costs.set(provider, cost);
  }
}
