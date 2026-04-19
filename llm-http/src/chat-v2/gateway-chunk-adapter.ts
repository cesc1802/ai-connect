import type { StreamDelta } from "llm-gateway";
import type { TokenDelta } from "@ai-connect/shared";

export function adaptStreamDeltaToTokenDelta(delta: StreamDelta | undefined): TokenDelta | null {
  if (!delta) return null;

  switch (delta.type) {
    case "text":
      return { kind: "text", text: delta.text };

    case "tool_call_start": {
      const toolCall = delta.toolCall;
      if (!toolCall?.id || !toolCall.function?.name) return null;
      return {
        kind: "tool_use_start",
        toolCallId: toolCall.id,
        name: toolCall.function.name,
      };
    }

    case "tool_call_delta":
      return {
        kind: "tool_use_delta",
        toolCallId: delta.toolCallId,
        arguments: delta.arguments,
      };

    default:
      return null;
  }
}
