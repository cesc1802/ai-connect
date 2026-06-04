import {
  WsClientCommand,
  WsServerEvent,
  type ChatSendCmd,
  type ChatAbortCmd,
} from '@/schemas/ws-events';

export type WSConnectionState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closed'
  | 'reconnecting';

export type WSClientOptions = {
  url: string;
  getAccessToken: () => string | null;
  onEvent: (evt: WsServerEvent) => void;
  onStateChange?: (state: WSConnectionState) => void;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  maxReconnectAttempts?: number;
  WebSocketImpl?: typeof WebSocket;
};

const DEFAULT_HEARTBEAT_INTERVAL = 30_000;
const DEFAULT_HEARTBEAT_TIMEOUT = 10_000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 6;

export class WSClient {
  private ws: WebSocket | null = null;
  private state: WSConnectionState = 'idle';
  private reconnectAttempts = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private explicitlyClosed = false;
  private readonly impl: typeof WebSocket;
  private readonly heartbeatIntervalMs: number;
  private readonly heartbeatTimeoutMs: number;
  private readonly maxReconnectAttempts: number;

  constructor(private readonly opts: WSClientOptions) {
    this.impl = opts.WebSocketImpl ?? WebSocket;
    this.heartbeatIntervalMs = opts.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL;
    this.heartbeatTimeoutMs = opts.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT;
    this.maxReconnectAttempts =
      opts.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
  }

  getState(): WSConnectionState {
    return this.state;
  }

  connect(): void {
    if (this.state === 'connecting' || this.state === 'open') return;
    this.explicitlyClosed = false;
    this.openSocket();
  }

  send(cmd: ChatSendCmd | ChatAbortCmd | WsClientCommand): void {
    const parsed = WsClientCommand.safeParse(cmd);
    if (!parsed.success) {
      throw new Error(`Invalid WS command: ${parsed.error.message}`);
    }
    if (!this.ws || this.ws.readyState !== this.impl.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.ws.send(JSON.stringify(parsed.data));
  }

  close(): void {
    this.explicitlyClosed = true;
    this.clearTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState('closed');
  }

  private openSocket(): void {
    this.setState(this.reconnectAttempts === 0 ? 'connecting' : 'reconnecting');
    const token = this.opts.getAccessToken();
    const url = token
      ? `${this.opts.url}?access_token=${encodeURIComponent(token)}`
      : this.opts.url;

    try {
      this.ws = new this.impl(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.addEventListener('open', this.handleOpen);
    this.ws.addEventListener('message', this.handleMessage);
    this.ws.addEventListener('close', this.handleClose);
    this.ws.addEventListener('error', this.handleError);
  }

  private handleOpen = (): void => {
    this.reconnectAttempts = 0;
    this.setState('open');
    this.startHeartbeat();
  };

  private handleMessage = (evt: MessageEvent): void => {
    let raw: unknown;
    try {
      raw = JSON.parse(typeof evt.data === 'string' ? evt.data : String(evt.data));
    } catch {
      this.opts.onEvent({
        type: 's.error',
        code: 'PARSE_ERROR',
        message: 'Inbound frame was not valid JSON',
      });
      return;
    }
    const parsed = WsServerEvent.safeParse(raw);
    if (!parsed.success) {
      this.opts.onEvent({
        type: 's.error',
        code: 'PARSE_ERROR',
        message: 'Inbound frame failed schema validation',
      });
      return;
    }
    if (parsed.data.type === 's.pong') {
      this.clearPongTimer();
      return;
    }
    this.opts.onEvent(parsed.data);
  };

  private handleClose = (): void => {
    this.clearTimers();
    if (this.explicitlyClosed) {
      this.setState('closed');
      return;
    }
    this.scheduleReconnect();
  };

  private handleError = (): void => {
    // close event fires after error; reconnect handled there.
  };

  private startHeartbeat(): void {
    this.clearHeartbeatTimer();
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== this.impl.OPEN) return;
      try {
        this.ws.send(JSON.stringify({ type: 'c.ping', ts: Date.now() }));
      } catch {
        return;
      }
      this.pongTimer = setTimeout(() => {
        if (this.ws) this.ws.close();
      }, this.heartbeatTimeoutMs);
    }, this.heartbeatIntervalMs);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setState('closed');
      return;
    }
    const delay = Math.min(30_000, 500 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.setState('reconnecting');
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
  }

  private setState(next: WSConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.opts.onStateChange?.(next);
  }

  private clearTimers(): void {
    this.clearHeartbeatTimer();
    this.clearPongTimer();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearPongTimer(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }
}

export const DEFAULT_WS_URL: string =
  (import.meta.env.VITE_WS_URL as string | undefined) ??
  (typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/chat/v2`
    : 'ws://localhost/ws/chat/v2');
