/**
 * Anthropic Provider Example
 * Demonstrates direct usage of the Anthropic Claude API
 *
 * Run: ANTHROPIC_API_KEY=sk-... npx tsx examples/anthropic-example.ts
 */

// Import the Anthropic provider from our llm-gateway package
import { AnthropicProvider } from "../src/providers/anthropic-provider.js";

// Create provider instance with API key from environment variable
// The API key authenticates your requests to Claude's servers
const anthropic = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// === Basic Chat Completion ===
// Send a message and wait for the complete response
console.log("=== Anthropic Chat ===");
const response = await anthropic.chatCompletion({
  // Model to use - claude-sonnet-4-20250514 is fast and capable
  model: "claude-sonnet-4-20250514",
  // Messages array - each message has a role and content
  messages: [{ role: "user", content: "Say hello in one sentence." }],
  // Maximum tokens (words/pieces) in the response
  maxTokens: 50,
});

// Print the response text and token usage
console.log("Response:", response.content);
console.log("Tokens:", response.usage);

// === Streaming Response ===
// Get the response piece by piece as it's generated
console.log("\n=== Streaming ===");
process.stdout.write("Response: ");

// Loop through each chunk as it arrives
for await (const chunk of anthropic.streamCompletion({
  model: "claude-sonnet-4-20250514",
  messages: [{ role: "user", content: "Count 1 to 5." }],
  maxTokens: 50,
})) {
  // Only print text chunks (not tool calls or other delta types)
  if (chunk.delta.type === "text") {
    process.stdout.write(chunk.delta.text);
  }
}

console.log("\n\nDone!");
