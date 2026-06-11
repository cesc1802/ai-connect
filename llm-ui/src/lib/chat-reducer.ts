import type {
  ChatAction,
  ChatState,
  Msg,
  ToolCall,
} from "./chat-types";
import { initialChatState } from "./chat-types";

// Pure reducer translating ServerV2Message events (already routed via
// ChatAction by use-chat-socket) into UI state. No Math.random / Date.now /
// crypto calls — all volatile values are carried on action payloads, so
// the reducer remains deterministic and unit-testable without React.

export interface ReducerLogger {
  warn(msg: string, meta?: unknown): void;
}

const defaultLogger: ReducerLogger = {
  warn: (m, meta) =>
    // eslint-disable-next-line no-console
    console.warn(`[chat-reducer] ${m}`, meta ?? ""),
};

export function createChatReducer(
  logger: ReducerLogger = defaultLogger,
): (state: ChatState, action: ChatAction) => ChatState {
  return function chatReducer(state, action) {
    switch (action.type) {
      case "SEND_USER":
        return handleSendUser(state, action);
      case "SERVER_STARTED":
        return handleServerStarted(state, action);
      case "SERVER_TOKEN":
        return handleServerToken(state, action, logger);
      case "SERVER_COMPLETED":
        return handleServerCompleted(state, action, logger);
      case "SERVER_FAILED":
        return handleServerFailed(state, action, logger);
      case "SERVER_ABORTED":
        return handleServerAborted(state, action, logger);
      case "SERVER_ERROR":
        return handleServerError(state, action);
      case "ABORT_BEFORE_STARTED":
        return handleAbortBeforeStarted(state, action);
      case "CONNECTION_LOST":
        return handleConnectionLost(state);
      case "LOAD_HISTORY":
        return { ...initialChatState, messages: action.messages };
      default: {
        const _exhaustive: never = action;
        return state;
      }
    }
  };
}

export const chatReducer = createChatReducer();

// FIFO match: the oldest assistant draft whose requestId is still unset.
// Exported so use-chat-socket can pre-detect a pending abort before
// dispatching SERVER_STARTED.
export function findPendingAssistantDraft(state: ChatState): Msg | undefined {
  return state.messages.find(
    (m) =>
      m.role === "assistant" &&
      m.status === "pending" &&
      m.requestId === undefined,
  );
}

function findDraftByRequestId(state: ChatState, requestId: string): Msg | undefined {
  return state.messages.find((m) => m.requestId === requestId);
}

// --- handlers ---

function handleSendUser(
  state: ChatState,
  action: Extract<ChatAction, { type: "SEND_USER" }>,
): ChatState {
  const userMsg: Msg = {
    localId: action.localId,
    role: "user",
    text: action.text,
    toolCalls: [],
    status: "complete",
  };
  const draft: Msg = {
    localId: action.localId,
    role: "assistant",
    text: "",
    toolCalls: [],
    status: "pending",
  };
  return {
    ...state,
    messages: [...state.messages, userMsg, draft],
    activeLocalId: action.localId,
    activeRequestId: null,
    status: "sending",
  };
}

function handleServerStarted(
  state: ChatState,
  action: Extract<ChatAction, { type: "SERVER_STARTED" }>,
): ChatState {
  const draft = findPendingAssistantDraft(state);
  if (!draft) return state;

  const nextPending = new Set(state.pendingAbortLocalIds);
  nextPending.delete(draft.localId);

  return {
    ...state,
    messages: state.messages.map((m) =>
      m === draft
        ? { ...m, requestId: action.requestId, status: "streaming" }
        : m,
    ),
    activeRequestId: action.requestId,
    pendingAbortLocalIds: nextPending,
    status: "streaming",
  };
}

function handleServerToken(
  state: ChatState,
  action: Extract<ChatAction, { type: "SERVER_TOKEN" }>,
  logger: ReducerLogger,
): ChatState {
  const draft = findDraftByRequestId(state, action.requestId);
  if (!draft) {
    logger.warn("SERVER_TOKEN for unknown requestId", {
      requestId: action.requestId,
    });
    return state;
  }
  const delta = action.delta;
  if (delta.kind === "thinking") {
    return state; // out of scope v1
  }
  if (delta.kind === "text") {
    return replaceMsg(state, draft, { ...draft, text: draft.text + delta.text });
  }
  if (delta.kind === "tool_use_start") {
    const existing = draft.toolCalls.find((t) => t.id === delta.toolCallId);
    if (existing) return state; // duplicate start; ignore
    const tc: ToolCall = {
      id: delta.toolCallId,
      name: delta.name,
      argsBuffer: "",
      status: "running",
    };
    return replaceMsg(state, draft, {
      ...draft,
      toolCalls: [...draft.toolCalls, tc],
    });
  }
  // tool_use_delta
  const idx = draft.toolCalls.findIndex((t) => t.id === delta.toolCallId);
  if (idx < 0) {
    logger.warn("tool_use_delta for unknown toolCallId", {
      toolCallId: delta.toolCallId,
    });
    return state;
  }
  const updated: ToolCall = {
    ...draft.toolCalls[idx],
    argsBuffer: draft.toolCalls[idx].argsBuffer + delta.arguments,
  };
  const nextTools = [...draft.toolCalls];
  nextTools[idx] = updated;
  return replaceMsg(state, draft, { ...draft, toolCalls: nextTools });
}

function handleServerCompleted(
  state: ChatState,
  action: Extract<ChatAction, { type: "SERVER_COMPLETED" }>,
  logger: ReducerLogger,
): ChatState {
  const draft = findDraftByRequestId(state, action.requestId);
  if (!draft) {
    logger.warn("SERVER_COMPLETED for unknown requestId", {
      requestId: action.requestId,
    });
    return state;
  }
  const sealedTools = draft.toolCalls.map((t) =>
    t.status === "running" ? { ...t, status: "complete" as const } : t,
  );
  return clearActive(
    replaceMsg(state, draft, {
      ...draft,
      toolCalls: sealedTools,
      status: "complete",
    }),
  );
}

function handleServerFailed(
  state: ChatState,
  action: Extract<ChatAction, { type: "SERVER_FAILED" }>,
  logger: ReducerLogger,
): ChatState {
  const draft = findDraftByRequestId(state, action.requestId);
  if (!draft) {
    logger.warn("SERVER_FAILED for unknown requestId", {
      requestId: action.requestId,
    });
    return state;
  }
  return clearActive(
    replaceMsg(state, draft, {
      ...draft,
      status: "error",
      errorCode: action.code,
      errorMessage: action.message,
    }),
  );
}

function handleServerAborted(
  state: ChatState,
  action: Extract<ChatAction, { type: "SERVER_ABORTED" }>,
  logger: ReducerLogger,
): ChatState {
  const draft = findDraftByRequestId(state, action.requestId);
  if (!draft) {
    logger.warn("SERVER_ABORTED for unknown requestId", {
      requestId: action.requestId,
    });
    return state;
  }
  return clearActive(
    replaceMsg(state, draft, {
      ...draft,
      status: "aborted",
      abortReason: "user",
    }),
  );
}

// s.error has no requestId, so it is attributed to the in-flight draft, if
// any. Errors outside a send (e.g. aborting an unowned request) are ignored.
function handleServerError(
  state: ChatState,
  action: Extract<ChatAction, { type: "SERVER_ERROR" }>,
): ChatState {
  if (!state.activeLocalId) return state;
  const draft = state.messages.find(
    (m) =>
      m.localId === state.activeLocalId &&
      m.role === "assistant" &&
      (m.status === "pending" || m.status === "streaming"),
  );
  if (!draft) return state;
  return clearActive(
    replaceMsg(state, draft, {
      ...draft,
      status: "error",
      errorCode: action.code,
      errorMessage: action.message,
    }),
  );
}

function handleAbortBeforeStarted(
  state: ChatState,
  action: Extract<ChatAction, { type: "ABORT_BEFORE_STARTED" }>,
): ChatState {
  const nextPending = new Set(state.pendingAbortLocalIds);
  nextPending.add(action.localId);
  return { ...state, pendingAbortLocalIds: nextPending };
}

function handleConnectionLost(state: ChatState): ChatState {
  const messages = state.messages.map((m) =>
    m.status === "pending" || m.status === "streaming"
      ? { ...m, status: "aborted" as const, abortReason: "network" as const }
      : m,
  );
  return {
    ...state,
    messages,
    activeLocalId: null,
    activeRequestId: null,
    pendingAbortLocalIds: new Set(),
    status: "idle",
  };
}

// --- helpers ---

function replaceMsg(state: ChatState, oldMsg: Msg, newMsg: Msg): ChatState {
  return {
    ...state,
    messages: state.messages.map((m) => (m === oldMsg ? newMsg : m)),
  };
}

function clearActive(state: ChatState): ChatState {
  return {
    ...state,
    activeLocalId: null,
    activeRequestId: null,
    status: "idle",
  };
}
