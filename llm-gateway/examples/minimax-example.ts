/**
 * MiniMax Provider Example
 * Demonstrates usage of the MiniMax LLM API (China-based provider)
 *
 * Run: MINIMAX_API_KEY=... MINIMAX_GROUP_ID=... npx tsx examples/minimax-example.ts
 */

// Import the MiniMax provider from our llm-gateway package
import { MiniMaxProvider } from "../src/providers/minimax-provider.js";

// Create provider with API key and group ID from environment
// MiniMax requires both an API key AND a group ID for authentication
const minimax = new MiniMaxProvider({
  apiKey: process.env.MINIMAX_API_KEY!,
  groupId: process.env.MINIMAX_GROUP_ID!,
});

// === Basic Chat Completion ===
// Send a message and wait for the complete response
console.log("=== MiniMax Chat ===");
const response = await minimax.chatCompletion({
  // Model to use - abab6.5s-chat is MiniMax's standard model
  model: "abab6.5s-chat",
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
for await (const chunk of minimax.streamCompletion({
  model: "abab6.5s-chat",
  messages: [{ role: "user", content: "Count 1 to 5." }],
  maxTokens: 50,
})) {
  // Only print text chunks
  if (chunk.delta.type === "text") {
    process.stdout.write(chunk.delta.text);
  }
}

console.log("\n\nDone!");
