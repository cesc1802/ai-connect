import { ws } from 'msw';
import { WsClientCommand, type ChatSendCmd } from '@/schemas/ws-events';

const chat = ws.link('ws://*/ws/chat/v2');

const FAKE_TOKENS = [
  'Sure', ', ', 'here', '’', 's', ' a ', 'streamed ',
  'response ', 'from ', 'the ', 'mock ', 'server', '. ',
  'Each ', 'chunk ', 'arrives ', 'with ', 'a ', 'short ', 'delay', '.',
];

const TOKEN_INTERVAL_MS = 40;

function randomId(prefix: string): string {
  const r = Math.floor(Math.random() * 1e9).toString(36);
  return `${prefix}_${r}`;
}

type WsClient = { send: (data: string) => void };

function streamChatResponse(client: WsClient, cmd: ChatSendCmd): {
  cancel: () => void;
  meta: { conversationId: string; messageId: string };
} {
  const conversationId = cmd.conversationId ?? randomId('cnv');
  const messageId = randomId('msg');
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const sendJson = (data: unknown) => {
    try {
      client.send(JSON.stringify(data));
    } catch {
      // socket closed
    }
  };

  sendJson({ type: 's.chat.started', conversationId, messageId });

  let i = 0;
  const tickNext = () => {
    if (cancelled) return;
    if (i >= FAKE_TOKENS.length) {
      sendJson({
        type: 's.chat.completed',
        conversationId,
        messageId,
        finishReason: 'stop',
        usage: { promptTokens: cmd.message.content.length, completionTokens: FAKE_TOKENS.length },
      });
      if (cmd.conversationId === null) {
        sendJson({
          type: 's.conversation.title_generated',
          conversationId,
          title: cmd.message.content.slice(0, 40),
        });
      }
      return;
    }
    sendJson({
      type: 's.chat.token',
      conversationId,
      messageId,
      delta: FAKE_TOKENS[i],
    });
    i += 1;
    timer = setTimeout(tickNext, TOKEN_INTERVAL_MS);
  };
  timer = setTimeout(tickNext, TOKEN_INTERVAL_MS);

  return {
    cancel: () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sendJson({ type: 's.chat.aborted', conversationId, messageId });
    },
    meta: { conversationId, messageId },
  };
}

export const wsChatV2Handler = chat.addEventListener('connection', ({ client }) => {
  const inFlight = new Map<string, { cancel: () => void }>();

  client.addEventListener('message', (event) => {
    let raw: unknown;
    try {
      raw = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data));
    } catch {
      client.send(
        JSON.stringify({
          type: 's.error',
          code: 'PARSE_ERROR',
          message: 'Invalid JSON',
        }),
      );
      return;
    }
    const parsed = WsClientCommand.safeParse(raw);
    if (!parsed.success) {
      client.send(
        JSON.stringify({
          type: 's.error',
          code: 'BAD_COMMAND',
          message: parsed.error.issues[0]?.message ?? 'Invalid command',
        }),
      );
      return;
    }

    const cmd = parsed.data;
    if (cmd.type === 'c.ping') {
      client.send(JSON.stringify({ type: 's.pong', ts: Date.now() }));
      return;
    }
    if (cmd.type === 'c.chat.abort') {
      const handle = inFlight.get(cmd.messageId);
      if (handle) {
        handle.cancel();
        inFlight.delete(cmd.messageId);
      }
      return;
    }
    if (cmd.type === 'c.chat.send') {
      const handle = streamChatResponse(client, cmd);
      inFlight.set(handle.meta.messageId, handle);
    }
  });
});

export const wsHandlers = [wsChatV2Handler];
