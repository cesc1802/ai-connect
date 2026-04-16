/**
 * Gateway Basic Example - Unified API
 * Demonstrates the LLMGateway's unified interface across providers
 *
 * Run: MINIMAX_API_KEY=... npx tsx examples/gateway-basic.ts
 */

// Import the main gateway class
import {LLMGateway} from "../src/gateway.js";

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

// === Basic Chat with Gateway ===
// The gateway provides a consistent interface for all providers
console.log("=== Gateway Chat ===");

// Both providers use the same "provider/model" format:
const MODEL = "ollama/qwen2.5:7b-instruct";  // Ollama provider
// const MODEL = "minimax/MiniMax-M2.7";     // MiniMax provider

const response = await gateway.chat({
    model: MODEL,
    messages: [{role: "user", content: "What is 2+2?"}],
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
