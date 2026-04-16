/**
 * Gateway Streaming Example
 * Demonstrates streaming responses through the gateway
 *
 * Run: ANTHROPIC_API_KEY=... npx tsx examples/gateway-streaming.ts
 */

// Import the main gateway class
import { LLMGateway } from "../src/gateway.js";

// Create gateway with Anthropic provider
const gateway = new LLMGateway({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
  },
  defaultProvider: "anthropic",
});

// === Streaming Response ===
// Stream responses piece by piece as they're generated
// This gives users immediate feedback instead of waiting
console.log("=== Streaming ===");
process.stdout.write("Response: ");

// The stream() method returns an async iterator
for await (const chunk of gateway.stream({
  model: "claude-sonnet-4-20250514",
  messages: [{ role: "user", content: "Write a haiku about coding." }],
  maxTokens: 100,
})) {
  // Each chunk contains a delta with new content
  if (chunk.delta.type === "text") {
    // Print each piece as it arrives
    process.stdout.write(chunk.delta.text);
  }

  // The final chunk includes the finish reason and usage stats
  if (chunk.finishReason) {
    console.log("\n\nFinish reason:", chunk.finishReason);
    if (chunk.usage) {
      console.log("Usage:", chunk.usage);
    }
  }
}

// === Cleanup ===
await gateway.dispose();
console.log("\nDone!");
