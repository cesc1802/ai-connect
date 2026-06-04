import type { Conversation } from '@/schemas/conversation';

export const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: 'cnv_001',
    workspaceId: 'wsp_personal',
    title: 'Welcome to ai-connect',
    createdAt: '2026-06-01T09:00:00.000Z',
    updatedAt: '2026-06-01T09:00:00.000Z',
  },
  {
    id: 'cnv_002',
    workspaceId: 'wsp_personal',
    title: 'Draft launch announcement',
    createdAt: '2026-06-02T11:30:00.000Z',
    updatedAt: '2026-06-03T08:15:00.000Z',
  },
  {
    id: 'cnv_003',
    workspaceId: 'wsp_acme',
    title: 'Quarterly planning notes',
    createdAt: '2026-06-03T14:00:00.000Z',
    updatedAt: '2026-06-04T10:05:00.000Z',
  },
];
