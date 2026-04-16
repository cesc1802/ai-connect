/**
 * OpenAI Provider Example
 * Demonstrates direct usage of the OpenAI GPT API
 *
 * Run: OPENAI_API_KEY=sk-... npx tsx examples/openai-example.ts
 */

// Import the OpenAI provider from our llm-gateway package
import { OpenAIProvider } from "../src/providers/openai-provider.js";

// Create provider instance with API key from environment variable
// The API key authenticates your requests to OpenAI's servers
const openai = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
});

// === Basic Chat Completion ===
// Send a message and wait for the complete response
console.log("=== OpenAI Chat ===");
const response = await openai.chatCompletion({
  // Model to use - gpt-4o-mini is fast and cost-effective
  model: "gpt-4o-mini",
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
for await (const chunk of openai.streamCompletion({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Count 1 to 5." }],
  maxTokens: 50,
})) {
  // Only print text chunks (not tool calls or other delta types)
  if (chunk.delta.type === "text") {
    process.stdout.write(chunk.delta.text);
  }
}

console.log("\n\nDone!");
