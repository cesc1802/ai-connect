import { authHandlers } from './auth-handlers';
import { workspaceHandlers } from './workspace-handlers';
import { conversationHandlers } from './conversation-handlers';
import { resourcesHandlers } from './resources-handlers';
import { wsHandlers } from './ws-chat-v2-handler';
import { adminUsersHandlers } from './admin-users';
import { orgTemplatesHandlers } from './admin-org-templates-handlers';
import { adminOrgProvidersHandlers } from './admin-org-providers-handlers';
import { adminWsMembersHandlers } from './admin-ws-members-handlers';
import { adminWsRolesHandlers } from './admin-ws-roles-handlers';
import { adminWsProvidersHandlers } from './admin-ws-providers-handlers';
import { adminWsTemplatesHandlers } from './admin-ws-templates-handlers';
import { adminWsQuotasHandlers } from './admin-ws-quotas-handlers';
import { templatesHandlers } from './templates-handlers';

export const handlers = [
  ...authHandlers,
  ...workspaceHandlers,
  ...conversationHandlers,
  ...resourcesHandlers,
  ...wsHandlers,
  ...adminUsersHandlers,
  ...orgTemplatesHandlers,
  ...adminOrgProvidersHandlers,
  ...adminWsMembersHandlers,
  ...adminWsRolesHandlers,
  ...adminWsProvidersHandlers,
  ...adminWsTemplatesHandlers,
  ...adminWsQuotasHandlers,
  ...templatesHandlers,
];
