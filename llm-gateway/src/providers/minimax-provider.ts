import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities,
  ChatMessage,
  FinishReason,
  MiniMaxConfig,
} from "../core/index.js";
import { ProviderError, RateLimitError, AuthenticationError } from "../core/index.js";
import { BaseProvider } from "./base-provider.js";
import { ProviderFactory } from "../factory/index.js";

const MINIMAX_BASE_URL = "https://api.minimax.chat/v1";

/**
 * MiniMax API response types
 */
interface MiniMaxChatResponse {
  id: string;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

interface MiniMaxStreamChunk {
  id: string;
  choices: Array<{
    index: number;
    finish_reason?: string;
    delta: {
      role?: string;
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * MiniMax provider - China-based LLM with API key + group ID auth
 */
export class MiniMaxProvider extends BaseProvider {
  readonly name = "minimax" as const;
  readonly models = [
    "abab6.5s-chat",
    "abab6.5g-chat",
    "abab6.5t-chat",
    "abab5.5s-chat",
    "abab5.5-chat",
  ];

  private readonly apiKey: string;
  private readonly groupId: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(config: MiniMaxConfig) {
    super();
    this.apiKey = config.apiKey;
    this.groupId = config.groupId;
    this.baseUrl = config.baseUrl ?? MINIMAX_BASE_URL;
    this.defaultModel = config.defaultModel ?? "abab6.5s-chat";
  }

  capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tools: false,
      vision: false,
      jsonMode: false,
      maxContextTokens: 245_760,
    };
  }

  async chatCompletion(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    this.validateRequest(request);
    this.checkAbort(signal);

    const requestId = this.generateRequestId();
    this.startTiming(requestId);

    try {
      const response = await fetch(
        `${this.baseUrl}/text/chatcompletion_v2?GroupId=${this.groupId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: request.model || this.defaultModel,
            messages: this.mapMessages(request.messages),
            max_tokens: request.maxTokens,
            temperature: request.temperature ?? 0.9,
            top_p: request.topP ?? 0.95,
            stream: false,
          }),
          signal: signal ?? null,
        }
      );

      if (!response.ok) {
        throw await this.handleFetchError(response);
      }

      const data = (await response.json()) as MiniMaxChatResponse;
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
      const response = await fetch(
        `${this.baseUrl}/text/chatcompletion_v2?GroupId=${this.groupId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: request.model || this.defaultModel,
            messages: this.mapMessages(request.messages),
            max_tokens: request.maxTokens,
            temperature: request.temperature ?? 0.9,
            top_p: request.topP ?? 0.95,
            stream: true,
          }),
          signal: signal ?? null,
        }
      );

      if (!response.ok) {
        throw await this.handleFetchError(response);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new ProviderError("No response body", "minimax");
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
            if (!line.trim() || !line.startsWith("data: ")) continue;

            const data = line.slice(6);
            if (data === "[DONE]") {
              yield {
                id: requestId,
                delta: { type: "text", text: "" },
                finishReason: "stop",
              };
              continue;
            }

            let chunk: MiniMaxStreamChunk;
            try {
              chunk = JSON.parse(data) as MiniMaxStreamChunk;
            } catch {
              continue; // Skip malformed chunks
            }

            const choice = chunk.choices[0];

            if (choice?.delta?.content) {
              yield {
                id: chunk.id,
                delta: { type: "text", text: choice.delta.content },
              };
            }

            if (choice?.finish_reason) {
              const streamChunk: StreamChunk = {
                id: chunk.id,
                delta: { type: "text", text: "" },
                finishReason: this.mapFinishReason(choice.finish_reason),
              };
              if (chunk.usage) {
                streamChunk.usage = {
                  inputTokens: chunk.usage.prompt_tokens,
                  outputTokens: chunk.usage.completion_tokens,
                  totalTokens: chunk.usage.total_tokens,
                };
              }
              yield streamChunk;
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
   * Convert ChatMessage[] to MiniMax format
   */
  private mapMessages(messages: ChatMessage[]): Array<{ role: string; content: string }> {
    return messages.map((msg) => ({
      role: this.mapRole(msg.role),
      content: this.getTextContent(msg),
    }));
  }

  /**
   * Map role to MiniMax format
   */
  private mapRole(role: ChatMessage["role"]): string {
    switch (role) {
      case "system":
        return "system";
      case "user":
        return "user";
      case "assistant":
        return "assistant";
      case "tool":
        return "user";
      default:
        return "user";
    }
  }

  /**
   * Normalize MiniMax response to ChatResponse
   */
  private normalizeResponse(data: MiniMaxChatResponse, requestId: string): ChatResponse {
    const choice = data.choices[0];
    if (!choice) {
      throw new ProviderError("No response choices returned", "minimax");
    }

    return {
      id: data.id,
      content: choice.message.content,
      toolCalls: [],
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      model: data.model,
      finishReason: this.mapFinishReason(choice.finish_reason),
      latencyMs: this.getLatency(requestId),
    };
  }

  /**
   * Map MiniMax finish reason
   */
  private mapFinishReason(reason: string): FinishReason {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      default:
        return "stop";
    }
  }

  /**
   * Handle fetch errors
   */
  private async handleFetchError(response: Response): Promise<Error> {
    const text = await response.text().catch(() => "Unknown error");

    if (response.status === 401) {
      return new AuthenticationError("minimax", new Error(text));
    }
    if (response.status === 429) {
      return new RateLimitError("minimax", undefined, new Error(text));
    }

    return new ProviderError(`MiniMax error: ${text}`, "minimax", response.status);
  }

  /**
   * Map errors to typed errors
   */
  private mapError(error: unknown): Error {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return error;
      }
      return new ProviderError(error.message, "minimax", undefined, error);
    }
    return new ProviderError(String(error), "minimax");
  }
}

// Register with factory
ProviderFactory.register("minimax", MiniMaxProvider);
