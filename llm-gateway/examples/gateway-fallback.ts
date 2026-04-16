/**
 * Gateway Fallback Chain Example
 * Demonstrates automatic failover between providers
 *
 * Run: ANTHROPIC_API_KEY=... OPENAI_API_KEY=... npx tsx examples/gateway-fallback.ts
 */

// Import the main gateway class
import { LLMGateway } from "../src/gateway.js";

// Create gateway with multiple providers
// Both providers must be configured for fallback to work
const gateway = new LLMGateway({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
    openai: { apiKey: process.env.OPENAI_API_KEY! },
  },
  // Configure circuit breaker for failure detection
  circuitBreaker: {
    failureThreshold: 3, // Open circuit after 3 failures
    resetTimeoutMs: 30000, // Try again after 30 seconds
    halfOpenRequests: 2, // Test with 2 requests before fully closing
  },
});

// === Create Fallback Chain ===
// The fallback chain tries providers in order until one succeeds
const fallback = gateway.createFallbackChain(["anthropic", "openai"]);

console.log("=== Fallback Chain ===");
console.log("Provider order: anthropic -> openai\n");

// === Use Fallback Chain ===
// If anthropic fails, automatically tries openai
const response = await fallback.chatCompletion({
  model: "claude-sonnet-4-20250514", // Each provider maps to its own model
  messages: [{ role: "user", content: "Hello!" }],
  maxTokens: 50,
});

console.log("Response:", response.content);
console.log("Served by:", response.model);

// === Check Provider Health ===
// See which providers are currently healthy
console.log("\n=== Health Status ===");
for (const name of gateway.getProviderNames()) {
  const status = gateway.isProviderHealthy(name) ? "healthy" : "unhealthy";
  console.log(`${name}: ${status}`);
}

// === Cleanup ===
await gateway.dispose();
console.log("\nDone!");
