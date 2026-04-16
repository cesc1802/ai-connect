import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  Tool as AnthropicTool,
  ToolResultBlockParam,
  ImageBlockParam,
  TextBlockParam,
} from "@anthropic-ai/sdk/resources/messages";

import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities,
  ChatMessage,
  ToolDefinition,
  ToolCall,
  AnthropicConfig,
  FinishReason,
} from "../core/index.js";
import {
  ProviderError,
  RateLimitError,
  AuthenticationError,
  ModelNotFoundError,
  ValidationError,
} from "../core/index.js";
import { BaseProvider } from "./base-provider.js";
import { ProviderFactory } from "../factory/index.js";

const ANTHROPIC_MODELS = [
  "claude-3-5-sonnet-*",
  "claude-3-5-haiku-*",
  "claude-3-opus-*",
  "claude-3-sonnet-*",
  "claude-3-haiku-*",
  "claude-sonnet-4-*",
  "claude-opus-4-*",
];

/**
 * Anthropic provider implementation using official SDK
 */
export class AnthropicProvider extends BaseProvider {
  readonly name = "anthropic" as const;
  readonly models = ANTHROPIC_MODELS;

  private readonly client: Anthropic;
  private readonly defaultModel: string;

  constructor(config: AnthropicConfig) {
    super();
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
    this.defaultModel = config.defaultModel ?? "claude-sonnet-4-20250514";
  }

  capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tools: true,
      vision: true,
      jsonMode: false, // Anthropic doesn't have explicit JSON mode
      maxContextTokens: 200_000,
    };
  }

  async chatCompletion(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    this.validateRequest(request);
    this.checkAbort(signal);

    const requestId = this.generateRequestId();
    this.startTiming(requestId);

    try {
      const { system, messages } = this.mapMessages(request.messages);
      const params = this.buildRequestParams(request, system, messages);

      const response = await this.client.messages.create(params, { signal }) as Anthropic.Message;

      return this.normalizeResponse(response, requestId);
    } catch (error) {
      // Cleanup timing entry on error to prevent memory leak
      this.startTime.delete(requestId);
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
      const { system, messages } = this.mapMessages(request.messages);
      const params = this.buildRequestParams(request, system, messages);

      const stream = this.client.messages.stream(params, { signal });

      let currentToolCallId: string | undefined;

      for await (const event of stream) {
        this.checkAbort(signal);

        if (event.type === "content_block_start") {
          if (event.content_block.type === "tool_use") {
            currentToolCallId = event.content_block.id;
            yield {
              id: requestId,
              delta: {
                type: "tool_call_start",
                toolCall: {
                  id: event.content_block.id,
                  type: "function",
                  function: {
                    name: event.content_block.name,
                    arguments: "",
                  },
                },
              },
            };
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            yield {
              id: requestId,
              delta: { type: "text", text: event.delta.text },
            };
          } else if (event.delta.type === "input_json_delta" && currentToolCallId) {
            yield {
              id: requestId,
              delta: {
                type: "tool_call_delta",
                toolCallId: currentToolCallId,
                arguments: event.delta.partial_json,
              },
            };
          }
        } else if (event.type === "content_block_stop") {
          // Clear current tool call ID when block ends
          currentToolCallId = undefined;
        } else if (event.type === "message_stop") {
          const finalMessage = await stream.finalMessage();
          yield {
            id: requestId,
            delta: { type: "text", text: "" },
            finishReason: this.mapStopReason(finalMessage.stop_reason),
            usage: {
              inputTokens: finalMessage.usage.input_tokens,
              outputTokens: finalMessage.usage.output_tokens,
              totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
            },
          };
        }
      }
    } catch (error) {
      // Cleanup timing entry on error to prevent memory leak
      this.startTime.delete(requestId);
      throw this.mapError(error);
    }
  }

  /**
   * Build request params, only including defined values
   * This avoids TypeScript errors with exactOptionalPropertyTypes
   */
  private buildRequestParams(
    request: ChatRequest,
    system: string | undefined,
    messages: MessageParam[]
  ): Anthropic.MessageCreateParams {
    const params: Anthropic.MessageCreateParams = {
      model: request.model || this.defaultModel,
      max_tokens: request.maxTokens,
      messages,
    };

    if (system !== undefined) params.system = system;
    if (request.temperature !== undefined) params.temperature = request.temperature;
    if (request.topP !== undefined) params.top_p = request.topP;
    if (request.stop !== undefined) params.stop_sequences = request.stop;
    if (request.tools) params.tools = this.mapToolDefinitions(request.tools);

    const toolChoice = this.mapToolChoice(request.toolChoice);
    if (toolChoice !== undefined) params.tool_choice = toolChoice;

    return params;
  }

  /**
   * Convert ChatMessage[] to Anthropic format
   * Extracts system message and converts remaining messages
   */
  private mapMessages(messages: ChatMessage[]): {
    system: string | undefined;
    messages: MessageParam[];
  } {
    let system: string | undefined;
    const mappedMessages: MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        system = this.getTextContent(msg);
        continue;
      }

      if (msg.role === "tool") {
        // Tool results in Anthropic are sent as user messages with tool_result content
        if (!msg.toolCallId) {
          throw new ValidationError("toolCallId is required for tool messages", "toolCallId");
        }
        mappedMessages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.toolCallId,
              content: this.getTextContent(msg),
            } as ToolResultBlockParam,
          ],
        });
        continue;
      }

      const content = this.mapContent(msg);
      mappedMessages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content,
      });
    }

    return { system, messages: mappedMessages };
  }

  /**
   * Convert message content to Anthropic content blocks
   */
  private mapContent(
    msg: ChatMessage
  ): string | Array<TextBlockParam | ImageBlockParam> {
    if (typeof msg.content === "string") {
      return msg.content;
    }

    return msg.content.map((block): TextBlockParam | ImageBlockParam => {
      if (block.type === "text") {
        return { type: "text", text: block.text };
      }
      // Image block - Anthropic only supports base64 images
      if (block.source.type !== "base64") {
        throw new ValidationError(
          "Anthropic only supports base64 image sources. URL images must be fetched and converted first.",
          "image.source.type"
        );
      }
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: block.source.mediaType,
          data: block.source.data,
        },
      } as ImageBlockParam;
    });
  }

  /**
   * Convert ToolDefinition[] to Anthropic tools format
   */
  private mapToolDefinitions(tools: ToolDefinition[]): AnthropicTool[] {
    return tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters as AnthropicTool["input_schema"],
    }));
  }

  /**
   * Map tool choice to Anthropic format
   */
  private mapToolChoice(
    choice?: ChatRequest["toolChoice"]
  ): Anthropic.MessageCreateParams["tool_choice"] {
    if (!choice) return undefined;
    if (choice === "auto") return { type: "auto" };
    if (choice === "none") return undefined;
    if (choice === "required") return { type: "any" };
    if (typeof choice === "object") {
      return { type: "tool", name: choice.function.name };
    }
    return undefined;
  }

  /**
   * Normalize Anthropic response to ChatResponse
   */
  private normalizeResponse(
    response: Anthropic.Message,
    requestId: string
  ): ChatResponse {
    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    const toolCalls: ToolCall[] = response.content
      .filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
      .map((block) => ({
        id: block.id,
        type: "function" as const,
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input),
        },
      }));

    return {
      id: response.id,
      content: textContent,
      toolCalls,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      model: response.model,
      finishReason: this.mapStopReason(response.stop_reason),
      latencyMs: this.getLatency(requestId),
    };
  }

  /**
   * Map Anthropic stop reason to FinishReason
   */
  private mapStopReason(reason: string | null): FinishReason {
    switch (reason) {
      case "end_turn":
        return "stop";
      case "max_tokens":
        return "length";
      case "tool_use":
        return "tool_calls";
      case "stop_sequence":
        return "stop";
      default:
        return "stop";
    }
  }

  /**
   * Map Anthropic errors to typed errors
   * Preserves ValidationError and other LLMErrors without wrapping
   */
  private mapError(error: unknown): Error {
    // Pass through ValidationError without wrapping
    if (error instanceof ValidationError) {
      return error;
    }
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return new AuthenticationError("anthropic", error);
      }
      if (error.status === 429) {
        const retryAfter = error.headers?.["retry-after"];
        return new RateLimitError(
          "anthropic",
          retryAfter ? parseInt(retryAfter) * 1000 : undefined,
          error
        );
      }
      if (error.status === 404) {
        return new ModelNotFoundError("anthropic", "unknown", error);
      }
      return new ProviderError(error.message, "anthropic", error.status, error);
    }
    if (error instanceof Error) {
      return new ProviderError(error.message, "anthropic", undefined, error);
    }
    return new ProviderError(String(error), "anthropic");
  }
}

// Register with factory
ProviderFactory.register("anthropic", AnthropicProvider);
