import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionContentPart,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";

import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities,
  ChatMessage,
  ToolDefinition,
  ToolCall,
  OpenAIConfig,
  FinishReason,
} from "../core/index.js";
import {
  ProviderError,
  RateLimitError,
  AuthenticationError,
  ModelNotFoundError,
  ContentFilterError,
  ValidationError,
} from "../core/index.js";
import { BaseProvider } from "./base-provider.js";
import { ProviderFactory } from "../factory/index.js";

const OPENAI_MODELS = [
  "gpt-4o",
  "gpt-4o-*",
  "gpt-4o-mini",
  "gpt-4o-mini-*",
  "gpt-4-turbo",
  "gpt-4-turbo-*",
  "gpt-4",
  "gpt-4-*",
  "gpt-3.5-turbo",
  "gpt-3.5-turbo-*",
  "o1",
  "o1-*",
  "o3-mini",
  "o3-mini-*",
];

/**
 * OpenAI provider implementation using official SDK
 */
export class OpenAIProvider extends BaseProvider {
  readonly name = "openai" as const;
  readonly models = OPENAI_MODELS;

  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(config: OpenAIConfig) {
    super();
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
      baseURL: config.baseUrl,
    });
    this.defaultModel = config.defaultModel ?? "gpt-4o";
  }

  capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tools: true,
      vision: true,
      jsonMode: true,
      maxContextTokens: 128_000, // gpt-4o
    };
  }

  async chatCompletion(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    this.validateRequest(request);
    this.checkAbort(signal);

    const requestId = this.generateRequestId();
    this.startTiming(requestId);

    try {
      const response = await this.client.chat.completions.create(
        this.buildRequestParams(request),
        { signal }
      ) as OpenAI.ChatCompletion;

      return this.normalizeResponse(response, requestId);
    } catch (error) {
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
      const stream = await this.client.chat.completions.create(
        {
          ...this.buildRequestParams(request),
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal }
      );

      const toolCallAccumulator = new Map<number, Partial<ToolCall>>();

      for await (const chunk of stream) {
        this.checkAbort(signal);

        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;

        // Text content
        if (delta.content) {
          yield {
            id: chunk.id,
            delta: { type: "text", text: delta.content },
          };
        }

        // Tool calls
        if (delta.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            const existing = toolCallAccumulator.get(toolCall.index);

            if (!existing && toolCall.id) {
              // New tool call - only start when we have an id
              const toolCallId = toolCall.id;
              toolCallAccumulator.set(toolCall.index, {
                id: toolCallId,
                type: "function",
                function: {
                  name: toolCall.function?.name ?? "",
                  arguments: toolCall.function?.arguments ?? "",
                },
              });

              yield {
                id: chunk.id,
                delta: {
                  type: "tool_call_start",
                  toolCall: {
                    id: toolCallId,
                    type: "function",
                    function: {
                      name: toolCall.function?.name ?? "",
                      arguments: "",
                    },
                  },
                },
              };
            } else if (existing?.id && toolCall.function?.arguments) {
              // Append arguments
              yield {
                id: chunk.id,
                delta: {
                  type: "tool_call_delta",
                  toolCallId: existing.id,
                  arguments: toolCall.function.arguments,
                },
              };
            }
          }
        }

        // Finish reason
        if (choice.finish_reason) {
          const finishChunk: StreamChunk = {
            id: chunk.id,
            delta: { type: "text", text: "" },
            finishReason: this.mapFinishReason(choice.finish_reason),
          };

          if (chunk.usage) {
            finishChunk.usage = {
              inputTokens: chunk.usage.prompt_tokens,
              outputTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            };
          }

          yield finishChunk;
        }
      }
    } catch (error) {
      this.startTime.delete(requestId);
      throw this.mapError(error);
    }
  }

  /**
   * Build request params for OpenAI SDK
   */
  private buildRequestParams(request: ChatRequest): OpenAI.ChatCompletionCreateParams {
    const params: OpenAI.ChatCompletionCreateParams = {
      model: request.model || this.defaultModel,
      messages: this.mapMessages(request.messages),
      max_tokens: request.maxTokens,
    };

    if (request.temperature !== undefined) params.temperature = request.temperature;
    if (request.topP !== undefined) params.top_p = request.topP;
    if (request.stop !== undefined) params.stop = request.stop;
    if (request.tools) params.tools = this.mapToolDefinitions(request.tools);
    if (request.user !== undefined) params.user = request.user;

    const toolChoice = this.mapToolChoice(request.toolChoice);
    if (toolChoice !== undefined) params.tool_choice = toolChoice;

    const responseFormat = this.mapResponseFormat(request.responseFormat);
    if (responseFormat !== undefined) params.response_format = responseFormat;

    return params;
  }

  /**
   * Convert ChatMessage[] to OpenAI format
   */
  private mapMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
    return messages.map((msg): ChatCompletionMessageParam => {
      if (msg.role === "system") {
        return {
          role: "system",
          content: this.getTextContent(msg),
        };
      }

      if (msg.role === "tool") {
        if (!msg.toolCallId) {
          throw new ValidationError("toolCallId is required for tool messages", "toolCallId");
        }
        return {
          role: "tool",
          tool_call_id: msg.toolCallId,
          content: this.getTextContent(msg),
        } as ChatCompletionToolMessageParam;
      }

      if (msg.role === "assistant") {
        return {
          role: "assistant",
          content: this.getTextContent(msg),
        };
      }

      // User message
      const content = this.mapUserContent(msg);
      return {
        role: "user",
        content,
      };
    });
  }

  /**
   * Convert user message content to OpenAI format
   */
  private mapUserContent(
    msg: ChatMessage
  ): string | ChatCompletionContentPart[] {
    if (typeof msg.content === "string") {
      return msg.content;
    }

    return msg.content.map((block): ChatCompletionContentPart => {
      if (block.type === "text") {
        return { type: "text", text: block.text };
      }
      // Image block - OpenAI supports both URL and base64
      const imageUrl =
        block.source.type === "url"
          ? block.source.data
          : `data:${block.source.mediaType};base64,${block.source.data}`;

      return {
        type: "image_url",
        image_url: { url: imageUrl },
      };
    });
  }

  /**
   * Convert ToolDefinition[] to OpenAI tools format
   */
  private mapToolDefinitions(tools: ToolDefinition[]): ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));
  }

  /**
   * Map tool choice to OpenAI format
   */
  private mapToolChoice(
    choice?: ChatRequest["toolChoice"]
  ): OpenAI.ChatCompletionToolChoiceOption | undefined {
    if (!choice) return undefined;
    if (choice === "auto") return "auto";
    if (choice === "none") return "none";
    if (choice === "required") return "required";
    if (typeof choice === "object") {
      return { type: "function", function: { name: choice.function.name } };
    }
    return undefined;
  }

  /**
   * Map response format to OpenAI format
   */
  private mapResponseFormat(
    format?: ChatRequest["responseFormat"]
  ): OpenAI.ChatCompletionCreateParams["response_format"] | undefined {
    if (!format) return undefined;
    if (format.type === "text") return { type: "text" };
    if (format.type === "json_object") return { type: "json_object" };
    if (format.type === "json_schema") {
      return {
        type: "json_schema",
        json_schema: {
          name: "response",
          schema: format.jsonSchema,
        },
      };
    }
    return undefined;
  }

  /**
   * Normalize OpenAI response to ChatResponse
   */
  private normalizeResponse(
    response: OpenAI.ChatCompletion,
    requestId: string
  ): ChatResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw new ProviderError("No response choices returned", "openai");
    }

    const message = choice.message;
    const toolCalls: ToolCall[] = (message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    return {
      id: response.id,
      content: message.content ?? "",
      toolCalls,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      model: response.model,
      finishReason: this.mapFinishReason(choice.finish_reason),
      latencyMs: this.getLatency(requestId),
    };
  }

  /**
   * Map OpenAI finish reason to FinishReason
   */
  private mapFinishReason(reason: string | null): FinishReason {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "tool_calls":
        return "tool_calls";
      case "content_filter":
        return "content_filter";
      default:
        return "stop";
    }
  }

  /**
   * Map OpenAI errors to typed errors
   * Preserves ValidationError and other LLMErrors without wrapping
   */
  private mapError(error: unknown): Error {
    // Pass through ValidationError without wrapping
    if (error instanceof ValidationError) {
      return error;
    }
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return new AuthenticationError("openai", error);
      }
      if (error.status === 429) {
        const retryAfter = error.headers?.["retry-after"];
        return new RateLimitError(
          "openai",
          retryAfter ? parseInt(retryAfter) * 1000 : undefined,
          error
        );
      }
      if (error.status === 404) {
        return new ModelNotFoundError("openai", "unknown", error);
      }
      if (error.message?.includes("content_filter")) {
        return new ContentFilterError("openai", error);
      }
      return new ProviderError(error.message, "openai", error.status, error);
    }
    if (error instanceof Error) {
      return new ProviderError(error.message, "openai", undefined, error);
    }
    return new ProviderError(String(error), "openai");
  }
}

// Register with factory
ProviderFactory.register("openai", OpenAIProvider);
