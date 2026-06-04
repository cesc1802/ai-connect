import { z } from 'zod';

export const ProviderKind = z.enum([
  'openai',
  'anthropic',
  'google',
  'azure-openai',
  'custom',
]);
export type ProviderKind = z.infer<typeof ProviderKind>;

export const Model = z.object({
  id: z.string(),
  displayName: z.string(),
  contextWindow: z.number().int().positive().optional(),
});
export type Model = z.infer<typeof Model>;

export const Provider = z.object({
  id: z.string(),
  displayName: z.string(),
  providerKind: ProviderKind,
  isEnabled: z.boolean(),
  models: z.array(Model),
});
export type Provider = z.infer<typeof Provider>;

export const WorkspaceResourcesResponse = z.object({
  providers: z.array(Provider),
});
export type WorkspaceResourcesResponse = z.infer<typeof WorkspaceResourcesResponse>;
