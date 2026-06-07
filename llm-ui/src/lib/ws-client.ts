import {
  ClientV2MessageSchema,
  ServerV2MessageSchema,
  type ChatV2InboundEvent,
  type ClientV2Message,
} from "./chat-v2-protocol";

// Typed, reconnecting WebSocket client for /ws/chat/v2.
// Pure transport — owns no chat state. React layer lives in Phase 4.

export type ChatV2ClientState =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "permanent-closed";

export interface ChatV2CloseInfo {
  code: number;
  reason: string;
  permanent: boolean;
}

export interface ChatV2ClientOptions {
  url: string;
  token: string;
  onMessage: (event: ChatV2InboundEvent) => void;
  onParseError?: (raw: string, error: unknown) => void;
  onClose?: (info: ChatV2CloseInfo) => void;
  onStateChange?: (state: ChatV2ClientState) => void;
  logger?: { warn: (msg: string, meta?: unknown) => void };
  // Test seams. Production callers should not pass these.
  webSocketFactory?: (url: string) => WebSocket;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

export class NotConnectedError extends Error {
  constructor() {
    super("ChatV2Client: socket is not open");
    this.name = "NotConnectedError";
  }
}

const HEARTBEAT_MS = 30_000;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_CAP_MS = 30_000;
const AUTH_FAIL_LIMIT = 3;
// Codes returned by ws-upgrade-auth.ts and policy violations from the server.
// 4401 is the conventional "auth failed" code used by ws-upgrade-auth.
const AUTH_FAIL_CODES = new Set<number>([1008, 4401]);

export class ChatV2Client {
  private state: ChatV2ClientState = "idle";
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private authFailureStreak = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pendingAbortLocalIds = new Set<string>();
  private disposed = false;

  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;

  constructor(private readonly opts: ChatV2ClientOptions) {
    this.setTimeoutFn = opts.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = opts.clearTimeoutFn ?? clearTimeout;
    this.setIntervalFn = opts.setIntervalFn ?? setInterval;
    this.clearIntervalFn = opts.clearIntervalFn ?? clearInterval;
  }

  getState(): ChatV2ClientState {
    return this.state;
  }

  connect(): void {
    if (this.disposed) return;
    if (this.state === "open" || this.state === "connecting") return;
    this.openSocket();
  }

  send(msg: ClientV2Message): void {
    if (this.state !== "open" || !this.ws) {
      throw new NotConnectedError();
    }
    // Validate at the boundary so we never put malformed JSON on the wire.
    const parsed = ClientV2MessageSchema.parse(msg);
    // Spy note: print every outgoing message to the browser Console.
    console.log("[ws ▶ send]", parsed);
    this.ws.send(JSON.stringify(parsed));
  }

  // Phase 4 race-buffer: UI calls this when user aborts a send whose
  // requestId is not yet known. The mapping localId → requestId lives in
  // the Phase 4 reducer; this client just remembers the intent.
  abortPending(localId: string): void {
    this.pendingAbortLocalIds.add(localId);
  }

  // Phase 4 reducer calls this once it resolves a localId to a requestId,
  // to consume the buffered intent and emit the wire abort.
  flushPendingAbort(localId: string, requestId: string): boolean {
    if (!this.pendingAbortLocalIds.delete(localId)) return false;
    if (this.state !== "open" || !this.ws) return false;
    this.send({ type: "c.chat.abort", requestId });
    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
    this.transition("permanent-closed");
    if (this.ws) {
      try {
        this.ws.close(1000, "client dispose");
      } catch {
        // ignore — socket may already be closed
      }
      this.ws = null;
    }
  }

  // --- internals ---

  private openSocket(): void {
    this.transition("connecting");
    const url = `${this.opts.url}?token=${encodeURIComponent(this.opts.token)}`;
    const factory = this.opts.webSocketFactory ?? ((u: string) => new WebSocket(u));
    const ws = factory(url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.reconnectAttempt = 0;
      this.authFailureStreak = 0;
      this.transition("open");
      this.startHeartbeat();
    });

    ws.addEventListener("message", (ev: MessageEvent) => {
      this.handleInbound(typeof ev.data === "string" ? ev.data : String(ev.data));
    });

    ws.addEventListener("error", (ev) => {
      // The "close" handler does the actual recovery — error events
      // fire just before close and carry no useful info in browsers.
      // Surface a breadcrumb only when a logger is wired.
      this.opts.logger?.warn("ws error", ev);
    });

    ws.addEventListener("close", (ev: CloseEvent) => {
      this.handleClose(ev.code, ev.reason);
    });
  }

  private handleInbound(raw: string): void {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (err) {
      this.opts.onParseError?.(raw, err);
      return;
    }
    const result = ServerV2MessageSchema.safeParse(json);
    if (!result.success) {
      this.opts.onParseError?.(raw, result.error);
      return;
    }
    // Spy note: print every incoming message to the browser Console.
    console.log("[ws ◀ recv]", result.data);
    this.opts.onMessage(result.data);
  }

  private handleClose(code: number, reason: string): void {
    this.stopHeartbeat();
    this.ws = null;

    if (this.disposed || this.state === "permanent-closed") return;

    const wasStreaming = this.state === "open";

    if (AUTH_FAIL_CODES.has(code)) {
      this.authFailureStreak += 1;
    } else {
      this.authFailureStreak = 0;
    }

    const permanent =
      code === 1000 || this.authFailureStreak >= AUTH_FAIL_LIMIT;

    // Transition before invoking observers so onClose / onMessage see
    // a consistent state via getState().
    if (permanent) {
      this.transition("permanent-closed");
    }

    this.opts.onClose?.({ code, reason, permanent });

    if (wasStreaming) {
      // Server aborts in-flight requests on session close
      // (connection-session.ts:220-222). Tell the reducer so it can
      // mark active drafts (stopped, network).
      this.opts.onMessage({
        type: "client.connection.lost",
        at: nowMs(),
      });
    }

    if (permanent) return;

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.transition("reconnecting");
    const delay = Math.min(
      BACKOFF_CAP_MS,
      BACKOFF_BASE_MS * 2 ** this.reconnectAttempt
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = this.setTimeoutFn(() => {
      this.reconnectTimer = null;
      if (this.disposed) return;
      this.openSocket();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = this.setIntervalFn(() => {
      if (this.state !== "open" || !this.ws) return;
      try {
        this.send({ type: "c.ping" });
      } catch (err) {
        this.opts.logger?.warn("heartbeat send failed", err);
      }
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      this.clearIntervalFn(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer !== null) {
      this.clearTimeoutFn(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private transition(next: ChatV2ClientState): void {
    if (this.state === next) return;
    this.state = next;
    this.opts.onStateChange?.(next);
  }
}

function nowMs(): number {
  return Date.now();
}
