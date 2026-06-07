// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ChatV2Client,
  NotConnectedError,
  type ChatV2ClientOptions,
  type ChatV2ClientState,
  type ChatV2CloseInfo,
} from "../ws-client";
import type { ChatV2InboundEvent } from "../chat-v2-protocol";

// Minimal stand-in for the browser WebSocket. We only need the surface
// ChatV2Client actually touches: addEventListener / send / close.
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readonly url: string;
  readonly sent: string[] = [];
  private listeners = new Map<string, Array<(ev: unknown) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (ev: unknown) => void): void {
    const bucket = this.listeners.get(type) ?? [];
    bucket.push(listener);
    this.listeners.set(type, bucket);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code = 1000, reason = ""): void {
    this.emit("close", { code, reason });
  }

  // Test helpers.
  emit(type: string, ev: unknown): void {
    for (const fn of this.listeners.get(type) ?? []) fn(ev);
  }
  emitOpen(): void {
    this.emit("open", {});
  }
  emitMessage(data: string): void {
    this.emit("message", { data });
  }
  emitClose(code: number, reason = ""): void {
    this.emit("close", { code, reason });
  }
}

function makeClient(overrides: Partial<ChatV2ClientOptions> = {}) {
  const onMessage = vi.fn<(e: ChatV2InboundEvent) => void>();
  const onParseError = vi.fn();
  const onClose = vi.fn<(i: ChatV2CloseInfo) => void>();
  const onStateChange = vi.fn<(s: ChatV2ClientState) => void>();

  const client = new ChatV2Client({
    url: "ws://example/ws/chat/v2",
    token: "tok-123",
    onMessage,
    onParseError,
    onClose,
    onStateChange,
    webSocketFactory: (u) => new FakeWebSocket(u) as unknown as WebSocket,
    ...overrides,
  });

  return { client, onMessage, onParseError, onClose, onStateChange };
}

beforeEach(() => {
  FakeWebSocket.instances.length = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ChatV2Client.connect", () => {
  it("appends the token as a query param and transitions to open", () => {
    const { client, onStateChange } = makeClient();
    client.connect();

    const ws = FakeWebSocket.instances[0];
    expect(ws.url).toBe("ws://example/ws/chat/v2?token=tok-123");
    expect(onStateChange).toHaveBeenLastCalledWith("connecting");

    ws.emitOpen();
    expect(client.getState()).toBe("open");
    expect(onStateChange).toHaveBeenLastCalledWith("open");
  });
});

describe("ChatV2Client.send", () => {
  it("throws NotConnectedError before the socket is open", () => {
    const { client } = makeClient();
    expect(() =>
      client.send({
        type: "c.chat.send",
        model: "gpt-4o",
        messages: [{ role: "user", content: "hi" }],
      })
    ).toThrow(NotConnectedError);
  });

  it("serializes a valid c.chat.send to JSON on the wire", () => {
    const { client } = makeClient();
    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.emitOpen();

    client.send({
      type: "c.chat.send",
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(ws.sent).toHaveLength(1);
    const parsed = JSON.parse(ws.sent[0]);
    expect(parsed).toEqual({
      type: "c.chat.send",
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("rejects schema-invalid client messages before send", () => {
    const { client } = makeClient();
    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.emitOpen();

    expect(() =>
      client.send({
        type: "c.chat.send",
        model: "",
        messages: [{ role: "user", content: "hi" }],
      })
    ).toThrow();
    expect(ws.sent).toHaveLength(0);
  });
});

describe("ChatV2Client inbound parsing", () => {
  it("forwards a valid streamed token message to onMessage", () => {
    const { client, onMessage } = makeClient();
    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.emitOpen();

    ws.emitMessage(
      JSON.stringify({
        type: "s.chat.token",
        requestId: "req-1",
        index: 0,
        delta: { kind: "text", text: "Hello" },
      })
    );

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0][0]).toMatchObject({
      type: "s.chat.token",
      requestId: "req-1",
    });
  });

  it("routes unknown server types to onParseError without crashing", () => {
    const { client, onMessage, onParseError } = makeClient();
    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.emitOpen();

    ws.emitMessage(JSON.stringify({ type: "s.unknown", foo: 1 }));

    expect(onParseError).toHaveBeenCalledTimes(1);
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("routes malformed JSON to onParseError", () => {
    const { client, onParseError } = makeClient();
    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.emitOpen();

    ws.emitMessage("{not valid json");
    expect(onParseError).toHaveBeenCalledTimes(1);
  });
});

describe("ChatV2Client heartbeat", () => {
  it("sends c.ping every 30s while open", () => {
    const { client } = makeClient();
    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.emitOpen();

    expect(ws.sent).toHaveLength(0);
    vi.advanceTimersByTime(30_000);
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toEqual({ type: "c.ping" });

    vi.advanceTimersByTime(30_000);
    expect(ws.sent).toHaveLength(2);
  });

  it("stops the heartbeat after close", () => {
    const { client } = makeClient();
    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.emitOpen();
    ws.emitClose(1006, "boom");

    vi.advanceTimersByTime(60_000);
    expect(ws.sent).toHaveLength(0);
  });
});

describe("ChatV2Client reconnect", () => {
  it("uses exponential backoff capped at 30s for repeated failed connects", () => {
    const { client } = makeClient();
    client.connect();
    // First socket DOES open once so we have a session worth losing; after
    // that, every reconnect attempt fails before "open" so the attempt
    // counter accumulates.
    FakeWebSocket.instances[0].emitOpen();
    FakeWebSocket.instances[0].emitClose(1006, "drop");

    // Cap kicks in around attempt 5 → expected delays for attempts 0..5.
    const expectedDelays = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
    for (let i = 0; i < expectedDelays.length; i++) {
      const expected = expectedDelays[i];
      const beforeCount = FakeWebSocket.instances.length;
      vi.advanceTimersByTime(expected - 1);
      expect(FakeWebSocket.instances.length).toBe(beforeCount);
      vi.advanceTimersByTime(1);
      expect(FakeWebSocket.instances.length).toBe(beforeCount + 1);
      // New socket fails before opening to keep the streak alive.
      FakeWebSocket.instances.at(-1)!.emitClose(1006, "drop");
    }
    expect(client.getState()).toBe("reconnecting");
  });

  it("emits synthetic client.connection.lost when streaming socket drops", () => {
    const { client, onMessage } = makeClient();
    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.emitOpen();
    ws.emitClose(1006, "drop");

    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "client.connection.lost" })
    );
  });

  it("stops reconnecting after 3 consecutive auth-failure closes", () => {
    const { client, onClose } = makeClient();
    client.connect();

    // Auth rejection happens during upgrade — no "open" event fires.
    for (let i = 0; i < 3; i++) {
      FakeWebSocket.instances.at(-1)!.emitClose(4401, "unauthorized");
      vi.advanceTimersByTime(60_000);
    }

    expect(onClose).toHaveBeenLastCalledWith(
      expect.objectContaining({ permanent: true })
    );
    expect(client.getState()).toBe("permanent-closed");
  });

  it("does not reconnect on a clean 1000 close", () => {
    const { client } = makeClient();
    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.emitOpen();
    ws.emitClose(1000, "bye");
    vi.advanceTimersByTime(60_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(client.getState()).toBe("permanent-closed");
  });
});

describe("ChatV2Client abort round-trip", () => {
  it("sends c.chat.abort with the resolved requestId", () => {
    const { client } = makeClient();
    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.emitOpen();

    client.send({ type: "c.chat.abort", requestId: "req-42" });
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: "c.chat.abort",
      requestId: "req-42",
    });
  });

  it("flushPendingAbort fires after a buffered abort intent resolves", () => {
    const { client } = makeClient();
    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.emitOpen();

    client.abortPending("local-1");
    const flushed = client.flushPendingAbort("local-1", "req-99");
    expect(flushed).toBe(true);
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: "c.chat.abort",
      requestId: "req-99",
    });

    // Second flush of same localId is a no-op.
    expect(client.flushPendingAbort("local-1", "req-99")).toBe(false);
  });
});

describe("ChatV2Client.dispose", () => {
  it("cancels pending reconnect and goes permanent-closed", () => {
    const { client } = makeClient();
    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.emitOpen();
    ws.emitClose(1006, "drop");

    client.dispose();
    vi.advanceTimersByTime(60_000);

    // No second instance was ever constructed.
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(client.getState()).toBe("permanent-closed");
  });
});
