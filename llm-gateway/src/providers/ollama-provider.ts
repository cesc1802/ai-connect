import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities,
  ChatMessage,
  ToolDefinition,
  ToolCall,
  OllamaConfig,
  ContentBlock,
} from "../core/index.js";
import { ProviderError } from "../core/index.js";
import { BaseProvider } from "./base-provider.js";
import { ProviderFactory } from "../factory/index.js";

/**
 * Ollama API response types
 */
interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * Ollama provider - local inference with OpenAI-compatible format
 */
export class OllamaProvider extends BaseProvider {
  readonly name = "ollama" as const;
  readonly models = ["*"]; // Ollama supports any model available locally

  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(config: OllamaConfig) {
    super();
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.defaultModel = config.defaultModel ?? "llama3.2";
  }

  capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tools: true,
      vision: true,
      jsonMode: true,
      maxContextTokens: 128_000,
    };
  }

  async chatCompletion(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    this.validateRequest(request);
    this.checkAbort(signal);

    const requestId = this.generateRequestId();
    this.startTiming(requestId);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: request.model || this.defaultModel,
          messages: this.mapMessages(request.messages),
          stream: false,
          options: {
            temperature: request.temperature,
            top_p: request.topP,
            stop: request.stop,
            num_predict: request.maxTokens,
          },
          tools: request.tools ? this.mapToolDefinitions(request.tools) : undefined,
          format: request.responseFormat?.type === "json_object" ? "json" : undefined,
        }),
        signal: signal ?? null,
      });

      if (!response.ok) {
        throw await this.handleFetchError(response);
      }

      const data = (await response.json()) as OllamaChatResponse;
      return this.normalizeResponse(data, requestId);
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw this.mapError(error);
    }
  }

  async *streamCompletion(
    request: ChatRequest,
    signal?: AbortSignal
  ): AsyncIterable<StreamChunk> {
    this.validateRequest(request);
    this.checkAbort(signal);

    const requestId = this.generateRequestId();
    this.startTiming(requestId);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: request.model || this.defaultModel,
          messages: this.mapMessages(request.messages),
          stream: true,
          options: {
            temperature: request.temperature,
            top_p: request.topP,
            stop: request.stop,
            num_predict: request.maxTokens,
          },
          tools: request.tools ? this.mapToolDefinitions(request.tools) : undefined,
          format: request.responseFormat?.type === "json_object" ? "json" : undefined,
        }),
        signal: signal ?? null,
      });

      if (!response.ok) {
        throw await this.handleFetchError(response);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new ProviderError("No response body", "ollama");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          this.checkAbort(signal);
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;

            let chunk: OllamaStreamChunk;
            try {
              chunk = JSON.parse(line) as OllamaStreamChunk;
            } catch {
              continue; // Skip malformed chunks
            }

            if (chunk.message?.content) {
              yield {
                id: requestId,
                delta: { type: "text", text: chunk.message.content },
              };
            }

            if (chunk.done) {
              yield {
                id: requestId,
                delta: { type: "text", text: "" },
                finishReason: "stop",
                usage: {
                  inputTokens: chunk.prompt_eval_count ?? 0,
                  outputTokens: chunk.eval_count ?? 0,
                  totalTokens: (chunk.prompt_eval_count ?? 0) + (chunk.eval_count ?? 0),
                },
              };
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw this.mapError(error);
    }
  }

  /**
   * Convert ChatMessage[] to Ollama format
   */
  private mapMessages(
    messages: ChatMessage[]
  ): Array<{ role: string; content: string; images?: string[] }> {
    return messages.map((msg) => {
      const images = this.extractImages(msg);
      return {
        role: msg.role,
        content: this.getTextContent(msg),
        ...(images.length > 0 && { images }),
      };
    });
  }

  /**
   * Extract base64 images from message
   */
  private extractImages(msg: ChatMessage): string[] {
    if (typeof msg.content === "string") return [];

    return msg.content
      .filter((block): block is ContentBlock & { type: "image" } => block.type === "image")
      .filter((block) => block.source.type === "base64")
      .map((block) => block.source.data);
  }

  /**
   * Convert ToolDefinition[] to Ollama format
   */
  private mapToolDefinitions(
    tools: ToolDefinition[]
  ): Array<{
    type: "function";
    function: { name: string; description: string; parameters: unknown };
  }> {
    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));
  }

  /**
   * Normalize Ollama response to ChatResponse
   */
  private normalizeResponse(data: OllamaChatResponse, requestId: string): ChatResponse {
    const toolCalls: ToolCall[] = (data.message.tool_calls ?? []).map((tc, i) => ({
      id: `${requestId}-tool-${i}`,
      type: "function" as const,
      function: {
        name: tc.function.name,
        arguments: JSON.stringify(tc.function.arguments),
      },
    }));

    return {
      id: requestId,
      content: data.message.content,
      toolCalls,
      usage: {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      model: data.model,
      finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
      latencyMs: this.getLatency(requestId),
    };
  }

  /**
   * Handle fetch errors
   */
  private async handleFetchError(response: Response): Promise<Error> {
    const text = await response.text().catch(() => "Unknown error");
    return new ProviderError(`Ollama error: ${text}`, "ollama", response.status);
  }

  /**
   * Map errors to typed errors
   */
  private mapError(error: unknown): Error {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return error;
      }
      if (error.message.includes("ECONNREFUSED")) {
        return new ProviderError("Ollama server not running", "ollama");
      }
      return new ProviderError(error.message, "ollama", undefined, error);
    }
    return new ProviderError(String(error), "ollama");
  }
}

// Register with factory
ProviderFactory.register("ollama", OllamaProvider);
