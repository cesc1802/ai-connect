import type { Provider } from '@/schemas/resources';
import type { WorkspaceRole } from '@/schemas/workspace';

export type ProviderFixture = Provider & {
  allowedRoles: WorkspaceRole[];
};

export const WORKSPACE_RESOURCES: Record<string, ProviderFixture[]> = {
  wsp_personal: [
    {
      id: 'prv_personal_openai',
      displayName: 'OpenAI',
      providerKind: 'openai',
      isEnabled: true,
      models: [
        { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini', contextWindow: 128000 },
        { id: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000 },
      ],
      allowedRoles: ['owner', 'admin', 'member', 'viewer'],
    },
    {
      id: 'prv_personal_anthropic',
      displayName: 'Anthropic',
      providerKind: 'anthropic',
      isEnabled: true,
      models: [
        { id: 'claude-3-5-sonnet', displayName: 'Claude 3.5 Sonnet', contextWindow: 200000 },
      ],
      allowedRoles: ['owner', 'admin', 'member', 'viewer'],
    },
    {
      id: 'prv_personal_google_disabled',
      displayName: 'Google (disabled)',
      providerKind: 'google',
      isEnabled: false,
      models: [
        { id: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', contextWindow: 1000000 },
      ],
      allowedRoles: ['owner', 'admin', 'member', 'viewer'],
    },
  ],
  wsp_acme: [
    {
      id: 'prv_acme_openai',
      displayName: 'OpenAI',
      providerKind: 'openai',
      isEnabled: true,
      models: [
        { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini', contextWindow: 128000 },
        { id: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000 },
      ],
      allowedRoles: ['owner', 'admin', 'member', 'viewer'],
    },
    {
      id: 'prv_acme_anthropic',
      displayName: 'Anthropic',
      providerKind: 'anthropic',
      isEnabled: true,
      models: [
        { id: 'claude-3-5-sonnet', displayName: 'Claude 3.5 Sonnet', contextWindow: 200000 },
      ],
      allowedRoles: ['owner', 'admin', 'member', 'viewer'],
    },
    {
      id: 'prv_acme_azure_admin_only',
      displayName: 'Azure OpenAI (admins only)',
      providerKind: 'azure-openai',
      isEnabled: true,
      models: [
        { id: 'gpt-4o-azure', displayName: 'GPT-4o (Azure)', contextWindow: 128000 },
      ],
      allowedRoles: ['owner', 'admin'],
    },
    {
      id: 'prv_acme_custom_disabled',
      displayName: 'Custom (disabled)',
      providerKind: 'custom',
      isEnabled: false,
      models: [
        { id: 'custom-llm-1', displayName: 'Custom LLM v1' },
      ],
      allowedRoles: ['owner', 'admin', 'member', 'viewer'],
    },
  ],
};
