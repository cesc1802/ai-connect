import type { ProviderConfig, ProviderName } from "../core/index.js";
import { ValidationError, PROVIDER_NAMES } from "../core/index.js";
import type { LLMProvider } from "../providers/index.js";

/**
 * Type map for provider configs
 */
type ProviderConfigMap = {
  anthropic: ProviderConfig["anthropic"];
  openai: ProviderConfig["openai"];
  ollama: ProviderConfig["ollama"];
  minimax: ProviderConfig["minimax"];
};

/**
 * Provider constructor type
 */
type ProviderConstructor<T extends ProviderName> = new (
  config: NonNullable<ProviderConfigMap[T]>
) => LLMProvider;

/**
 * Factory for creating LLM provider instances
 */
export class ProviderFactory {
  private static registry = new Map<ProviderName, ProviderConstructor<ProviderName>>();
  private providers = new Map<ProviderName, LLMProvider>();

  /**
   * Register a provider constructor
   * Called at module load time for each provider
   */
  static register<T extends ProviderName>(name: T, constructor: ProviderConstructor<T>): void {
    this.registry.set(name, constructor as ProviderConstructor<ProviderName>);
  }

  /**
   * Check if a provider is registered
   */
  static isRegistered(name: ProviderName): boolean {
    return this.registry.has(name);
  }

  /**
   * Get all registered provider names
   */
  static getRegisteredProviders(): ProviderName[] {
    return Array.from(this.registry.keys());
  }

  constructor(private readonly config: ProviderConfig) {}

  /**
   * Create or retrieve a cached provider instance
   */
  create<T extends ProviderName>(name: T): LLMProvider {
    // Return cached instance if exists
    const cached = this.providers.get(name);
    if (cached) {
      return cached;
    }

    // Validate provider name
    if (!PROVIDER_NAMES.includes(name)) {
      throw new ValidationError(`Unknown provider: ${name}`, "provider");
    }

    // Get constructor
    const Constructor = ProviderFactory.registry.get(name);
    if (!Constructor) {
      throw new ValidationError(
        `Provider '${name}' is not registered. Did you import it?`,
        "provider"
      );
    }

    // Get config
    const providerConfig = this.config[name];
    if (!providerConfig) {
      throw new ValidationError(`Configuration for '${name}' is required`, `providers.${name}`);
    }

    // Create instance
    const provider = new Constructor(providerConfig);
    this.providers.set(name, provider);

    return provider;
  }

  /**
   * Create all configured providers
   */
  createAll(): Map<ProviderName, LLMProvider> {
    const result = new Map<ProviderName, LLMProvider>();

    for (const name of PROVIDER_NAMES) {
      if (this.config[name]) {
        try {
          result.set(name, this.create(name));
        } catch {
          // Skip providers that aren't registered
        }
      }
    }

    return result;
  }

  /**
   * Get a provider if already created
   */
  get<T extends ProviderName>(name: T): LLMProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Check if a provider is configured
   */
  isConfigured(name: ProviderName): boolean {
    return this.config[name] !== undefined;
  }

  /**
   * Dispose all created providers
   */
  async disposeAll(): Promise<void> {
    const disposals = Array.from(this.providers.values()).map((p) => p.dispose());
    await Promise.all(disposals);
    this.providers.clear();
  }
}
