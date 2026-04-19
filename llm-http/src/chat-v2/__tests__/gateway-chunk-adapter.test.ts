import { describe, it, expect } from "vitest";
import { adaptStreamDeltaToTokenDelta } from "../gateway-chunk-adapter.js";
import type { StreamDelta } from "llm-gateway";

describe("adaptStreamDeltaToTokenDelta", () => {
  it("returns null for undefined delta", () => {
    expect(adaptStreamDeltaToTokenDelta(undefined)).toBeNull();
  });

  it("maps text delta to TokenDelta", () => {
    const delta: StreamDelta = { type: "text", text: "Hello" };
    expect(adaptStreamDeltaToTokenDelta(delta)).toEqual({
      kind: "text",
      text: "Hello",
    });
  });

  it("maps tool_call_start to tool_use_start", () => {
    const delta: StreamDelta = {
      type: "tool_call_start",
      toolCall: { id: "tc-1", type: "function", function: { name: "search", arguments: "" } },
    };
    expect(adaptStreamDeltaToTokenDelta(delta)).toEqual({
      kind: "tool_use_start",
      toolCallId: "tc-1",
      name: "search",
    });
  });

  it("returns null for tool_call_start with missing id", () => {
    const delta: StreamDelta = {
      type: "tool_call_start",
      toolCall: { type: "function", function: { name: "search", arguments: "" } },
    };
    expect(adaptStreamDeltaToTokenDelta(delta)).toBeNull();
  });

  it("returns null for tool_call_start with missing function name", () => {
    const delta: StreamDelta = {
      type: "tool_call_start",
      toolCall: { id: "tc-1", type: "function" },
    };
    expect(adaptStreamDeltaToTokenDelta(delta)).toBeNull();
  });

  it("maps tool_call_delta to tool_use_delta", () => {
    const delta: StreamDelta = {
      type: "tool_call_delta",
      toolCallId: "tc-1",
      arguments: '{"query":',
    };
    expect(adaptStreamDeltaToTokenDelta(delta)).toEqual({
      kind: "tool_use_delta",
      toolCallId: "tc-1",
      arguments: '{"query":',
    });
  });

  it("returns null for unknown delta type", () => {
    const delta = { type: "unknown_future_type", data: "test" } as unknown as StreamDelta;
    expect(adaptStreamDeltaToTokenDelta(delta)).toBeNull();
  });
});
