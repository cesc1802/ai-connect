import { describe, expect, it } from 'vitest';
import { WSClient } from '@/api/ws-client';
import type { WsServerEvent } from '@/schemas/ws-events';

const WS_URL = 'ws://localhost/ws/chat/v2';

function collectUntil(
  predicate: (evt: WsServerEvent) => boolean,
  timeoutMs = 4000,
): { client: WSClient; events: WsServerEvent[]; done: Promise<WsServerEvent[]> } {
  const events: WsServerEvent[] = [];
  let resolveDone!: (value: WsServerEvent[]) => void;
  let rejectDone!: (reason: unknown) => void;
  const done = new Promise<WsServerEvent[]>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const timer = setTimeout(
    () => rejectDone(new Error(`Timed out waiting for ws event after ${timeoutMs}ms`)),
    timeoutMs,
  );

  const client = new WSClient({
    url: WS_URL,
    getAccessToken: () => 'test-token',
    onEvent: (evt) => {
      events.push(evt);
      if (predicate(evt)) {
        clearTimeout(timer);
        resolveDone([...events]);
      }
    },
  });

  return { client, events, done };
}

describe('WSClient', () => {
  it('streams chat tokens and a completed event from the mock WS server', async () => {
    const { client, done } = collectUntil((e) => e.type === 's.chat.completed');
    client.connect();

    await new Promise((r) => setTimeout(r, 50));

    client.send({
      type: 'c.chat.send',
      conversationId: null,
      workspaceId: 'wsp_personal',
      message: { role: 'user', content: 'Hello there' },
    });

    const events = await done;
    client.close();

    const tokens = events.filter((e) => e.type === 's.chat.token');
    const completed = events.find((e) => e.type === 's.chat.completed');
    expect(tokens.length).toBeGreaterThanOrEqual(8);
    expect(completed).toBeDefined();
  }, 8000);

  it('rejects an invalid command before sending', async () => {
    const { client, done } = collectUntil(() => false, 200);
    client.connect();
    await new Promise((r) => setTimeout(r, 50));
    expect(() =>
      // @ts-expect-error — intentionally bad shape
      client.send({ type: 'c.chat.send', conversationId: null }),
    ).toThrow();
    client.close();
    await done.catch(() => undefined);
  });
});
