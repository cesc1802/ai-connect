import type { ChatRequest, ProviderName } from "../../core/index.js";
import type { IRoutingStrategy, ProviderInfo } from "../routing-strategy.js";

/**
 * Round-robin strategy for load balancing across providers
 */
export class RoundRobinStrategy implements IRoutingStrategy {
  readonly name = "round-robin";

  private counter = 0;

  select(_request: ChatRequest, providers: ProviderInfo[]): ProviderName | null {
    if (providers.length === 0) {
      return null;
    }

    // Filter to only healthy providers
    const healthy = providers.filter((p) => p.healthy);
    if (healthy.length === 0) {
      return null;
    }

    // Round-robin selection
    const index = this.counter % healthy.length;
    this.counter = (this.counter + 1) % Number.MAX_SAFE_INTEGER;

    return healthy[index]!.name;
  }

  /**
   * Reset the counter (useful for testing)
   */
  reset(): void {
    this.counter = 0;
  }
}
