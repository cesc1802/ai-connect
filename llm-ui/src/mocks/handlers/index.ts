import { authHandlers } from './auth-handlers';
import { workspaceHandlers } from './workspace-handlers';
import { conversationHandlers } from './conversation-handlers';
import { resourcesHandlers } from './resources-handlers';
import { wsHandlers } from './ws-chat-v2-handler';
import { adminUsersHandlers } from './admin-users';

export const handlers = [
  ...authHandlers,
  ...workspaceHandlers,
  ...conversationHandlers,
  ...resourcesHandlers,
  ...wsHandlers,
  ...adminUsersHandlers,
];
