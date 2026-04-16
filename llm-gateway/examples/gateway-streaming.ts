/**
 * Gateway Streaming Example
 * Demonstrates streaming responses through the gateway
 *
 * Run: npx tsx examples/gateway-streaming.ts
 */

// Import the main gateway class
import { LLMGateway } from "../src/gateway.js";

/**
 * Model Configuration Pattern
 *
 * CONSISTENT FORMAT: Always use "provider/model" for explicit routing
 * - ollama/qwen2.5:7b-instruct  → Routes to Ollama, uses qwen2.5:7b-instruct model
 * - minimax/MiniMax-M2.7        → Routes to MiniMax, uses MiniMax-M2.7 model
 *
 * The gateway strips the provider prefix before sending to the actual API.
 * This ensures predictable routing regardless of defaultProvider setting.
 */
const gateway = new LLMGateway({
    providers: {
        ollama: {
            baseUrl: "http://100.107.85.81:11434",
            defaultModel: "qwen2.5:7b-instruct"  // Used when model omitted
        },
        minimax: {
            baseUrl: 'https://api.minimax.io/v1',
            apiKey: process.env.MINIMAX_API_KEY || 'your-api-key-here',
            defaultModel: "MiniMax-M2.7"  // Used when model omitted
        },
    },
    defaultProvider: "ollama",
});

// === Streaming Response ===
// Stream responses piece by piece as they're generated
// This gives users immediate feedback instead of waiting
console.log("=== Streaming ===");
process.stdout.write("Response: ");

// The stream() method returns an async iterator
// Both providers use the same "provider/model" format:
const MODEL = "minimax/MiniMax-M2.7";   // MiniMax provider
// const MODEL = "ollama/qwen2.5:7b-instruct";  // Ollama provider

for await (const chunk of gateway.stream({
  model: MODEL,
  messages: [{ role: "user", content: "count from 1 to 20" }],
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
