import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities,
  ProviderName,
} from "../core/index.js";
import { FallbackExhaustedError } from "../core/index.js";
import type { LLMProvider } from "../providers/index.js";

/**
 * Fallback chain tries providers in order until one succeeds
 */
export class FallbackChain implements LLMProvider {
  readonly name: ProviderName;
  readonly models: string[];

  private readonly providers: LLMProvider[];

  constructor(providers: LLMProvider[]) {
    if (providers.length === 0) {
      throw new Error("FallbackChain requires at least one provider");
    }

    this.providers = providers;
    this.name = providers[0]!.name;
    this.models = [...new Set(providers.flatMap((p) => p.models))];
  }

  capabilities(): ProviderCapabilities {
    // Return intersection of capabilities
    const caps = this.providers.map((p) => p.capabilities());
    return {
      streaming: caps.every((c) => c.streaming),
      tools: caps.some((c) => c.tools),
      vision: caps.some((c) => c.vision),
      jsonMode: caps.some((c) => c.jsonMode),
      maxContextTokens: Math.max(...caps.map((c) => c.maxContextTokens)),
    };
  }

  supportsModel(model: string): boolean {
    return this.providers.some((p) => p.supportsModel(model));
  }

  async dispose(): Promise<void> {
    await Promise.all(this.providers.map((p) => p.dispose()));
  }

  /**
   * Get all providers in the chain
   */
  getProviders(): LLMProvider[] {
    return [...this.providers];
  }

  async chatCompletion(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    const errors: Error[] = [];

    for (const provider of this.providers) {
      try {
        return await provider.chatCompletion(request, signal);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        // Continue to next provider
      }
    }

    throw new FallbackExhaustedError(errors);
  }

  async *streamCompletion(
    request: ChatRequest,
    signal?: AbortSignal
  ): AsyncIterable<StreamChunk> {
    const errors: Error[] = [];

    for (const provider of this.providers) {
      try {
        // Attempt streaming from this provider
        const stream = provider.streamCompletion(request, signal);
        let hasYielded = false;

        for await (const chunk of stream) {
          hasYielded = true;
          yield chunk;
        }

        // If we got chunks, we're done
        if (hasYielded) {
          return;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        // Continue to next provider
      }
    }

    throw new FallbackExhaustedError(errors);
  }
}
