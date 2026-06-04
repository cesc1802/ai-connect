import { z } from 'zod';
import { WorkspaceRole } from '@/schemas/auth';

export const TemplateScope = z.enum(['suggested', 'workspace', 'personal']);
export type TemplateScope = z.infer<typeof TemplateScope>;

export const Template = z.object({
  id: z.string(),
  name: z.string(),
  scope: TemplateScope,
  body: z.string(),
  defaultModelId: z.string().optional(),
  role: WorkspaceRole.optional(),
});
export type Template = z.infer<typeof Template>;

export const TemplateListResponse = z.object({
  templates: z.array(Template),
});
export type TemplateListResponse = z.infer<typeof TemplateListResponse>;
