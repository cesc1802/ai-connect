import { createRoute } from '@tanstack/react-router';
import { authenticatedRoute } from './authenticated-route';
import { ChatPage } from '@/pages/chat-page';

export const chatIndexRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/chat',
  component: ChatPage,
});

export const chatConversationRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/chat/$conversationId',
  component: ChatPage,
});
