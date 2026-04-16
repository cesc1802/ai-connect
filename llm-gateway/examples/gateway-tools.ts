/**
 * Gateway Tool Calling Example
 * Demonstrates how to define and use tools (function calling)
 *
 * Run: ANTHROPIC_API_KEY=... npx tsx examples/gateway-tools.ts
 */

// Import the main gateway class and types
import { LLMGateway } from "../src/gateway.js";
import type { ToolDefinition } from "../src/core/types.js";

// Create gateway with Anthropic provider
const gateway = new LLMGateway({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
  },
  defaultProvider: "anthropic",
});

// === Define a Tool ===
// Tools let the model call functions you provide
// The model decides when to use them based on the conversation
const weatherTool: ToolDefinition = {
  type: "function",
  function: {
    name: "get_weather",
    description: "Get current weather for a location",
    // JSON Schema describing the function parameters
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City name, e.g. 'Tokyo' or 'San Francisco'",
        },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          description: "Temperature unit",
        },
      },
      required: ["location"],
    },
  },
};

// === Chat with Tools ===
console.log("=== Tool Calling ===");
const response = await gateway.chat({
  model: "claude-sonnet-4-20250514",
  messages: [{ role: "user", content: "What's the weather in Tokyo?" }],
  maxTokens: 200,
  // Pass the tools the model can use
  tools: [weatherTool],
});

// === Handle Tool Calls ===
// Check if the model wants to call a tool
if (response.toolCalls.length > 0) {
  console.log("Model wants to call tools:");
  for (const call of response.toolCalls) {
    console.log(`  - ${call.function.name}(${call.function.arguments})`);
  }
  console.log("\nIn a real app, you would:");
  console.log("  1. Execute the function with the given arguments");
  console.log("  2. Send the result back to the model");
  console.log("  3. Let the model formulate a final response");
} else {
  // Model responded directly without calling tools
  console.log("Response:", response.content);
}

// === Cleanup ===
await gateway.dispose();
console.log("\nDone!");
