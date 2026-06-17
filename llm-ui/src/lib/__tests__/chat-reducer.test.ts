// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  chatReducer,
  createChatReducer,
  findPendingAssistantDraft,
} from "../chat-reducer";
import {
  initialChatState,
  type ChatAction,
  type ChatState,
  type Msg,
} from "../chat-types";

function send(state: ChatState, localId: string, text = "hello"): ChatState {
  return chatReducer(state, { type: "SEND_USER", localId, text });
}

function started(
  state: ChatState,
  requestId: string,
  overrides: Partial<Extract<ChatAction, { type: "SERVER_STARTED" }>> = {},
): ChatState {
  return chatReducer(state, {
    type: "SERVER_STARTED",
    requestId,
    conversationId: "conv-1",
    model: "gpt-4o",
    startedAt: 1,
    ...overrides,
  });
}

describe("chat-reducer", () => {
  it("SEND_USER appends user msg + assistant draft and flips status to sending", () => {
    const s = send(initialChatState, "L1", "hi there");
    expect(s.messages).toHaveLength(2);
    expect(s.messages[0]).toMatchObject({
      localId: "L1",
      role: "user",
      text: "hi there",
      status: "complete",
    });
    expect(s.messages[1]).toMatchObject({
      localId: "L1",
      role: "assistant",
      text: "",
      status: "pending",
    });
    expect(s.activeLocalId).toBe("L1");
    expect(s.activeRequestId).toBeNull();
    expect(s.status).toBe("sending");
  });

  it("SERVER_STARTED upgrades the oldest pending draft with requestId and flips status to streaming", () => {
    let s = send(initialChatState, "L1");
    s = started(s, "R1");
    const draft = s.messages[1];
    expect(draft.requestId).toBe("R1");
    expect(draft.status).toBe("streaming");
    expect(s.activeRequestId).toBe("R1");
    expect(s.status).toBe("streaming");
  });

  it("SERVER_TOKEN (text) appends text to the matching draft", () => {
    let s = send(initialChatState, "L1");
    s = started(s, "R1");
    for (let i = 0; i < 5; i++) {
      s = chatReducer(s, {
        type: "SERVER_TOKEN",
        requestId: "R1",
        delta: { kind: "text", text: "x" },
      });
    }
    expect(s.messages[1].text).toBe("xxxxx");
  });

  it("SERVER_TOKEN tool_use_start + tool_use_delta accumulates args under toolCallId", () => {
    let s = send(initialChatState, "L1");
    s = started(s, "R1");
    s = chatReducer(s, {
      type: "SERVER_TOKEN",
      requestId: "R1",
      delta: { kind: "tool_use_start", toolCallId: "T1", name: "search" },
    });
    s = chatReducer(s, {
      type: "SERVER_TOKEN",
      requestId: "R1",
      delta: { kind: "tool_use_delta", toolCallId: "T1", arguments: '{"q":' },
    });
    s = chatReducer(s, {
      type: "SERVER_TOKEN",
      requestId: "R1",
      delta: { kind: "tool_use_delta", toolCallId: "T1", arguments: '"hi"}' },
    });
    expect(s.messages[1].toolCalls).toHaveLength(1);
    expect(s.messages[1].toolCalls[0]).toMatchObject({
      id: "T1",
      name: "search",
      argsBuffer: '{"q":"hi"}',
      status: "running",
    });
  });

  it("SERVER_TOKEN thinking is dropped silently", () => {
    let s = send(initialChatState, "L1");
    s = started(s, "R1");
    const prev = s;
    s = chatReducer(s, {
      type: "SERVER_TOKEN",
      requestId: "R1",
      delta: { kind: "thinking", text: "ponder..." },
    });
    expect(s).toBe(prev);
  });

  it("SERVER_COMPLETED seals draft + active tool calls, clears active*", () => {
    let s = send(initialChatState, "L1");
    s = started(s, "R1");
    s = chatReducer(s, {
      type: "SERVER_TOKEN",
      requestId: "R1",
      delta: { kind: "tool_use_start", toolCallId: "T1", name: "search" },
    });
    s = chatReducer(s, { type: "SERVER_COMPLETED", requestId: "R1" });
    expect(s.messages[1].status).toBe("complete");
    expect(s.messages[1].toolCalls[0].status).toBe("complete");
    expect(s.activeLocalId).toBeNull();
    expect(s.activeRequestId).toBeNull();
    expect(s.status).toBe("idle");
  });

  it("SERVER_FAILED marks draft error and clears active*", () => {
    let s = send(initialChatState, "L1");
    s = started(s, "R1");
    s = chatReducer(s, {
      type: "SERVER_FAILED",
      requestId: "R1",
      code: "RATE_LIMIT",
      message: "slow down",
    });
    expect(s.messages[1].status).toBe("error");
    expect(s.messages[1].errorCode).toBe("RATE_LIMIT");
    expect(s.messages[1].errorMessage).toBe("slow down");
    expect(s.activeLocalId).toBeNull();
    expect(s.status).toBe("idle");
  });

  it("SERVER_FAILED faults the in-flight draft even before SERVER_STARTED (guardrail block)", () => {
    // Pre-send guardrail blocks emit s.chat.failed with a requestId that was
    // never bound to the draft (no s.chat.started). The failure must still
    // fault the pending draft so the typing indicator clears.
    let s = send(initialChatState, "L1");
    s = chatReducer(s, {
      type: "SERVER_FAILED",
      requestId: "unbound-request-id",
      code: "guardrail_blocked",
      message: "Request blocked by guardrail policy",
    });
    expect(s.messages[1].status).toBe("error");
    expect(s.messages[1].errorCode).toBe("guardrail_blocked");
    expect(s.activeLocalId).toBeNull();
    expect(s.status).toBe("idle");
  });

  it("SERVER_ERROR faults the in-flight draft even before SERVER_STARTED", () => {
    let s = send(initialChatState, "L1");
    s = chatReducer(s, {
      type: "SERVER_ERROR",
      code: "invalid_template",
      message: "Template is not attached to this workspace",
    });
    expect(s.messages[1].status).toBe("error");
    expect(s.messages[1].errorCode).toBe("invalid_template");
    expect(s.activeLocalId).toBeNull();
    expect(s.status).toBe("idle");
  });

  it("SERVER_ERROR faults a streaming draft", () => {
    let s = send(initialChatState, "L1");
    s = started(s, "R1");
    s = chatReducer(s, { type: "SERVER_ERROR", code: "internal", message: "boom" });
    expect(s.messages[1].status).toBe("error");
    expect(s.activeRequestId).toBeNull();
  });

  it("SERVER_ERROR with no in-flight send is a no-op", () => {
    const s = chatReducer(initialChatState, {
      type: "SERVER_ERROR",
      code: "forbidden",
      message: "Cannot abort unowned request",
    });
    expect(s).toEqual(initialChatState);
  });

  it("SERVER_ABORTED marks draft aborted with reason=user", () => {
    let s = send(initialChatState, "L1");
    s = started(s, "R1");
    s = chatReducer(s, {
      type: "SERVER_ABORTED",
      requestId: "R1",
      reason: "client",
    });
    expect(s.messages[1].status).toBe("aborted");
    expect(s.messages[1].abortReason).toBe("user");
    expect(s.activeRequestId).toBeNull();
  });

  it("ABORT_BEFORE_STARTED + SERVER_STARTED clears pendingAbort and streams normally", () => {
    let s = send(initialChatState, "L1");
    s = chatReducer(s, { type: "ABORT_BEFORE_STARTED", localId: "L1" });
    expect(s.pendingAbortLocalIds.has("L1")).toBe(true);
    s = started(s, "R1");
    expect(s.pendingAbortLocalIds.has("L1")).toBe(false);
    expect(s.messages[1].requestId).toBe("R1");
  });

  it("CONNECTION_LOST flips pending+streaming drafts to aborted/network", () => {
    let s = send(initialChatState, "L1");
    s = started(s, "R1");
    s = chatReducer(s, {
      type: "SERVER_TOKEN",
      requestId: "R1",
      delta: { kind: "text", text: "partial" },
    });
    s = chatReducer(s, { type: "CONNECTION_LOST" });
    expect(s.messages[1].status).toBe("aborted");
    expect(s.messages[1].abortReason).toBe("network");
    expect(s.messages[1].text).toBe("partial");
    expect(s.activeLocalId).toBeNull();
    expect(s.activeRequestId).toBeNull();
    expect(s.status).toBe("idle");
  });

  it("LOAD_HISTORY replaces messages and resets active state", () => {
    const seeded: Msg[] = [
      {
        localId: "h1",
        role: "user",
        text: "old q",
        toolCalls: [],
        status: "complete",
      },
      {
        localId: "h1",
        role: "assistant",
        text: "old a",
        toolCalls: [],
        status: "complete",
      },
    ];
    let s = send(initialChatState, "L1");
    s = chatReducer(s, { type: "LOAD_HISTORY", messages: seeded });
    expect(s.messages).toEqual(seeded);
    expect(s.activeLocalId).toBeNull();
    expect(s.status).toBe("idle");
  });

  it("SERVER_TOKEN for unknown requestId logs and drops", () => {
    const logger = { warn: vi.fn() };
    const reducer = createChatReducer(logger);
    let s = send(initialChatState, "L1");
    s = reducer(s, { type: "SERVER_TOKEN", requestId: "GHOST", delta: { kind: "text", text: "x" } });
    expect(logger.warn).toHaveBeenCalledWith(
      "SERVER_TOKEN for unknown requestId",
      { requestId: "GHOST" },
    );
    expect(s.messages[1].text).toBe("");
  });

  it("tool_use_delta for unknown toolCallId logs and drops", () => {
    const logger = { warn: vi.fn() };
    const reducer = createChatReducer(logger);
    let s = send(initialChatState, "L1");
    s = reducer(s, {
      type: "SERVER_STARTED",
      requestId: "R1",
      conversationId: "c",
      model: "m",
      startedAt: 1,
    });
    s = reducer(s, {
      type: "SERVER_TOKEN",
      requestId: "R1",
      delta: { kind: "tool_use_delta", toolCallId: "GHOST", arguments: "{}" },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "tool_use_delta for unknown toolCallId",
      { toolCallId: "GHOST" },
    );
    expect(s.messages[1].toolCalls).toHaveLength(0);
  });

  it("findPendingAssistantDraft returns the oldest unresolved draft (FIFO)", () => {
    let s = send(initialChatState, "L1");
    s = send(s, "L2");
    const draft = findPendingAssistantDraft(s);
    expect(draft?.localId).toBe("L1");
  });

  it("reducer is pure — repeated dispatch yields equal state", () => {
    let s = send(initialChatState, "L1");
    s = started(s, "R1");
    const a: ChatAction = {
      type: "SERVER_TOKEN",
      requestId: "R1",
      delta: { kind: "text", text: "tok" },
    };
    const s1 = chatReducer(s, a);
    const s2 = chatReducer(s, a);
    expect(s1).toEqual(s2);
  });
});
