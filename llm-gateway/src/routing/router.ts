import type { ChatRequest, ProviderName } from "../core/index.js";
import { ValidationError } from "../core/index.js";
import type { LLMProvider } from "../providers/index.js";
import type { IRoutingStrategy, ProviderInfo } from "./routing-strategy.js";

/**
 * Router configuration
 */
export interface RouterConfig {
  strategy: IRoutingStrategy;
  defaultProvider?: ProviderName;
}

/**
 * Router manages provider selection using a configurable strategy
 */
export class Router {
  private readonly strategy: IRoutingStrategy;
  private readonly defaultProvider: ProviderName | null;
  private readonly providers = new Map<ProviderName, LLMProvider>();
  private readonly healthStatus = new Map<ProviderName, boolean>();

  constructor(config: RouterConfig) {
    this.strategy = config.strategy;
    this.defaultProvider = config.defaultProvider ?? null;
  }

  /**
   * Register a provider
   */
  register(name: ProviderName, provider: LLMProvider): void {
    this.providers.set(name, provider);
    this.healthStatus.set(name, true);
  }

  /**
   * Register multiple providers
   */
  registerAll(providers: Map<ProviderName, LLMProvider>): void {
    for (const [name, provider] of providers) {
      this.register(name, provider);
    }
  }

  /**
   * Unregister a provider
   */
  unregister(name: ProviderName): void {
    this.providers.delete(name);
    this.healthStatus.delete(name);
  }

  /**
   * Mark provider as unhealthy
   */
  markUnhealthy(name: ProviderName): void {
    this.healthStatus.set(name, false);
  }

  /**
   * Mark provider as healthy
   */
  markHealthy(name: ProviderName): void {
    this.healthStatus.set(name, true);
  }

  /**
   * Get health status
   */
  isHealthy(name: ProviderName): boolean {
    return this.healthStatus.get(name) ?? false;
  }

  /**
   * Get all registered provider names
   */
  getProviderNames(): ProviderName[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get a specific provider
   */
  getProvider(name: ProviderName): LLMProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Select a provider for the given request
   */
  selectProvider(request: ChatRequest): LLMProvider {
    // If model explicitly specifies provider, use it
    const explicitProvider = this.extractProviderFromModel(request.model);
    if (explicitProvider && this.providers.has(explicitProvider)) {
      const provider = this.providers.get(explicitProvider)!;
      if (this.isHealthy(explicitProvider)) {
        return provider;
      }
    }

    // Build provider info list for healthy providers
    const providerInfos: ProviderInfo[] = [];
    for (const [name, provider] of this.providers) {
      if (this.isHealthy(name)) {
        providerInfos.push({
          name,
          provider,
          healthy: true,
        });
      }
    }

    if (providerInfos.length === 0) {
      throw new ValidationError("No healthy providers available");
    }

    // Use strategy to select
    const selectedName = this.strategy.select(request, providerInfos);

    if (selectedName) {
      const provider = this.providers.get(selectedName);
      if (provider) {
        return provider;
      }
    }

    // Fallback to default
    if (this.defaultProvider) {
      const defaultProv = this.providers.get(this.defaultProvider);
      if (defaultProv && this.isHealthy(this.defaultProvider)) {
        return defaultProv;
      }
    }

    // Last resort: first healthy provider
    const firstHealthy = providerInfos[0];
    if (firstHealthy) {
      return firstHealthy.provider;
    }

    throw new ValidationError("No suitable provider found for request");
  }

  /**
   * Extract provider name from model string (e.g., "anthropic/claude-3-opus")
   */
  private extractProviderFromModel(model: string): ProviderName | null {
    const parts = model.split("/");
    if (parts.length >= 2) {
      const providerName = parts[0] as ProviderName;
      if (this.providers.has(providerName)) {
        return providerName;
      }
    }
    return null;
  }
}
