import type { ChatRequest, ProviderName } from "../../core/index.js";
import type { IRoutingStrategy, ProviderInfo } from "../routing-strategy.js";

/**
 * Capability-based strategy matches provider capabilities to request needs
 */
export class CapabilityBasedStrategy implements IRoutingStrategy {
  readonly name = "capability-based";

  select(_request: ChatRequest, providers: ProviderInfo[]): ProviderName | null {
    if (providers.length === 0) {
      return null;
    }

    // Filter to healthy providers
    const healthy = providers.filter((p) => p.healthy);
    if (healthy.length === 0) {
      return null;
    }

    // Determine required capabilities from request
    const needsTools = (_request.tools?.length ?? 0) > 0;
    const needsVision = this.hasVisionContent(_request);
    const needsJsonMode = _request.responseFormat?.type === "json_object";

    // Filter providers that meet requirements
    const capable = healthy.filter((info) => {
      const caps = info.provider.capabilities();

      if (needsTools && !caps.tools) return false;
      if (needsVision && !caps.vision) return false;
      if (needsJsonMode && !caps.jsonMode) return false;

      return true;
    });

    if (capable.length === 0) {
      // No provider meets all requirements, return null
      // Router will fallback to default
      return null;
    }

    // Return first capable (could be enhanced with scoring)
    return capable[0]!.name;
  }

  /**
   * Check if request contains vision content
   */
  private hasVisionContent(request: ChatRequest): boolean {
    for (const msg of request.messages) {
      if (typeof msg.content !== "string") {
        for (const block of msg.content) {
          if (block.type === "image") {
            return true;
          }
        }
      }
    }
    return false;
  }
}
