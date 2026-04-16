/**
 * Gateway Basic Example - Unified API
 * Demonstrates the LLMGateway's unified interface across providers
 *
 * Run: ANTHROPIC_API_KEY=... npx tsx examples/gateway-basic.ts
 */

// Import the main gateway class
import { LLMGateway } from "../src/gateway.js";

// Create gateway with configured providers
// The gateway provides a unified API regardless of which provider you use
const gateway = new LLMGateway({
  // Configure one or more providers
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
    // Uncomment to add more providers:
    // openai: { apiKey: process.env.OPENAI_API_KEY! },
  },
  // Set which provider to use by default
  defaultProvider: "anthropic",
});

// === Basic Chat with Gateway ===
// The gateway provides a consistent interface for all providers
console.log("=== Gateway Chat ===");
const response = await gateway.chat({
  model: "claude-sonnet-4-20250514",
  messages: [{ role: "user", content: "What is 2+2?" }],
  maxTokens: 50,
});

// Response format is consistent across all providers
console.log("Response:", response.content);
console.log("Model:", response.model);
console.log("Latency:", response.latencyMs, "ms");

// === Gateway Metrics ===
// The gateway tracks performance metrics across all providers
console.log("\n=== Metrics ===");
const metrics = gateway.getMetrics();
console.log("Total requests:", metrics.totalRequests);
console.log("Average latency:", metrics.averageLatencyMs, "ms");
console.log("Provider health:", metrics.providers);

// === Cleanup ===
// Always dispose the gateway when done to clean up resources
await gateway.dispose();
console.log("\nDone!");
