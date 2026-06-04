import { authHandlers } from './auth-handlers';
import { workspaceHandlers } from './workspace-handlers';
import { conversationHandlers } from './conversation-handlers';
import { wsHandlers } from './ws-chat-v2-handler';

export const handlers = [
  ...authHandlers,
  ...workspaceHandlers,
  ...conversationHandlers,
  ...wsHandlers,
];
