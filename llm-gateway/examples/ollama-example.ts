/**
 * Ollama Provider Example (Local LLM)
 * Demonstrates usage with a locally running Ollama server
 *
 * Prerequisites:
 *   brew install ollama      # Install Ollama
 *   ollama serve             # Start the server
 *   ollama pull llama3.2     # Download the model
 *
 * Run: npx tsx examples/ollama-example.ts
 */

// Import the Ollama provider from our llm-gateway package
import { OllamaProvider } from "../src/providers/ollama-provider.js";

// Create provider pointing to local Ollama server
// No API key needed - Ollama runs on your machine!
const ollama = new OllamaProvider({
  baseUrl: "http://100.107.85.81:11434",
  defaultModel: "qwen2.5:7b-instruct",
});

// === Basic Chat Completion ===
// Send a message and wait for the complete response
console.log("=== Ollama Chat ===");
const response = await ollama.chatCompletion({
  // Model must be pulled locally with `ollama pull llama3.2`
  model: "qwen2.5:7b-instruct",
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
for await (const chunk of ollama.streamCompletion({
  model: "qwen2.5:7b-instruct",
  messages: [{ role: "user", content: "Count 1 to 5." }],
  maxTokens: 50,
})) {
  // Only print text chunks
  if (chunk.delta.type === "text") {
    process.stdout.write(chunk.delta.text);
  }
}

console.log("\n\nDone!");
