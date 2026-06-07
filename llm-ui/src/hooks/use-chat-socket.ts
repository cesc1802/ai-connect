import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChatV2Client,
  type ChatV2ClientState,
} from "../lib/ws-client";
import type {
  ChatV2InboundEvent,
  ServerV2Message,
} from "../lib/chat-v2-protocol";
import { useChatStore } from "../lib/chat-context";
import { findPendingAssistantDraft } from "../lib/chat-reducer";
import type { ChatAction, Role } from "../lib/chat-types";

// Bridges ChatV2Client ↔ chat-reducer. Owns the singleton client via
// useRef, mints localIds for sends, intercepts s.chat.started to flush
// any abort-before-started intent, and routes every server event into
// the reducer.

export interface UseChatSocketOptions {
  url: string;
  // null = no auth yet — hook does not connect until a token is supplied.
  token: string | null;
  onParseError?: (raw: string, err: unknown) => void;
}

export interface SendParams {
  text: string;
  model: string;
  conversationId?: string;
}

export interface ChatSocketApi {
  send: (params: SendParams) => void;
  abort: () => void;
  socketState: ChatV2ClientState;
}

export function useChatSocket(opts: UseChatSocketOptions): ChatSocketApi {
  const { state, dispatch } = useChatStore();
  const [socketState, setSocketState] = useState<ChatV2ClientState>("idle");
  const clientRef = useRef<ChatV2Client | null>(null);

  // Reducer state is consulted inside async callbacks that close over
  // a stale snapshot otherwise.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const onParseErrorRef = useRef(opts.onParseError);
  useEffect(() => {
    onParseErrorRef.current = opts.onParseError;
  }, [opts.onParseError]);

  useEffect(() => {
    if (!opts.token) {
      setSocketState("idle");
      return;
    }
    const client = new ChatV2Client({
      url: opts.url,
      token: opts.token,
      onStateChange: setSocketState,
      onParseError: (raw, err) => onParseErrorRef.current?.(raw, err),
      onMessage: (ev) => routeInbound(ev, client, stateRef.current, dispatch),
    });
    clientRef.current = client;
    client.connect();
    return () => {
      client.dispose();
      clientRef.current = null;
    };
  }, [opts.url, opts.token, dispatch]);

  const send = useCallback<ChatSocketApi["send"]>(
    (params) => {
      const client = clientRef.current;
      if (!client) {
        throw new Error("useChatSocket: client not initialized (no token?)");
      }
      const localId = generateLocalId();
      const history = buildWireHistory(stateRef.current.messages);
      client.send({
        type: "c.chat.send",
        conversationId: params.conversationId,
        model: params.model,
        messages: [...history, { role: "user", content: params.text }],
      });
      dispatch({ type: "SEND_USER", localId, text: params.text });
    },
    [dispatch],
  );

  const abort = useCallback(() => {
    const client = clientRef.current;
    const s = stateRef.current;
    if (s.activeRequestId) {
      // Streaming already underway — wire abort directly.
      try {
        client?.send({ type: "c.chat.abort", requestId: s.activeRequestId });
      } catch {
        // Socket may have closed; reducer will normalize via CONNECTION_LOST.
      }
      return;
    }
    if (s.activeLocalId) {
      // Pre-started window — buffer intent on the client and reducer.
      client?.abortPending(s.activeLocalId);
      dispatch({ type: "ABORT_BEFORE_STARTED", localId: s.activeLocalId });
    }
  }, [dispatch]);

  return { send, abort, socketState };
}

// --- internals ---

function routeInbound(
  ev: ChatV2InboundEvent,
  client: ChatV2Client,
  snapshot: ReturnType<typeof useChatStore>["state"],
  dispatch: (action: ChatAction) => void,
): void {
  if (ev.type === "client.connection.lost") {
    dispatch({ type: "CONNECTION_LOST" });
    return;
  }
  if (ev.type === "s.chat.started") {
    // Resolve which draft this requestId binds to BEFORE dispatching so
    // we can flush any pending-abort intent before the reducer clears it.
    const draft = findPendingAssistantDraft(snapshot);
    if (draft) {
      client.flushPendingAbort(draft.localId, ev.requestId);
    }
    dispatch({
      type: "SERVER_STARTED",
      requestId: ev.requestId,
      conversationId: ev.conversationId,
      model: ev.model,
      startedAt: ev.startedAt,
    });
    return;
  }
  const action = mapServerEventToAction(ev);
  if (action) dispatch(action);
}

function mapServerEventToAction(ev: ServerV2Message): ChatAction | null {
  switch (ev.type) {
    case "s.chat.token":
      return { type: "SERVER_TOKEN", requestId: ev.requestId, delta: ev.delta };
    case "s.chat.completed":
      return { type: "SERVER_COMPLETED", requestId: ev.requestId };
    case "s.chat.failed":
      return {
        type: "SERVER_FAILED",
        requestId: ev.requestId,
        code: ev.code,
        message: ev.message,
      };
    case "s.chat.aborted":
      return {
        type: "SERVER_ABORTED",
        requestId: ev.requestId,
        reason: ev.reason,
      };
    case "s.chat.started":
    case "s.conversation.created":
    case "s.error":
    case "s.pong":
      // Handled elsewhere or out of scope for the reducer (Phase 6 picks
      // up conversation.created; transport handles pong; s.error is
      // surfaced via logger for now).
      return null;
  }
}

function buildWireHistory(messages: ReturnType<typeof useChatStore>["state"]["messages"]) {
  // Only "complete" assistant messages are part of the canonical history.
  // Drafts (pending/streaming/error/aborted) are excluded to keep the
  // wire payload deterministic.
  return messages
    .filter((m) => m.role === "user" || m.status === "complete")
    .map((m) => ({ role: m.role as Role, content: m.text }));
}

function generateLocalId(): string {
  // crypto.randomUUID requires a secure context (localhost qualifies).
  return globalThis.crypto.randomUUID();
}
