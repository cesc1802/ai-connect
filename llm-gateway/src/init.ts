/**
 * Initialization module - imports providers to register them with the factory.
 * Import this file to ensure all providers are registered.
 */

// These imports have side effects: they register providers with ProviderFactory
import "./providers/anthropic-provider.js";
import "./providers/openai-provider.js";
import "./providers/ollama-provider.js";
import "./providers/minimax-provider.js";
