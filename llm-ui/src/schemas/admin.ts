import { z } from 'zod';
import { ProviderKind } from './resources';
import { WorkspaceRole } from './auth';

export const AdminScope = z.enum(['org', 'workspace']);
export type AdminScope = z.infer<typeof AdminScope>;

// --- users ---
export const OrgUserStatus = z.enum(['active', 'pending', 'disabled']);
export type OrgUserStatus = z.infer<typeof OrgUserStatus>;

export const OrgUserRow = z.object({
  id: z.string(),
  email: z.string().email(),
  status: OrgUserStatus,
  joinedAt: z.string().datetime(),
});
export type OrgUserRow = z.infer<typeof OrgUserRow>;

export const OrgUserListResponse = z.object({
  users: z.array(OrgUserRow),
});
export type OrgUserListResponse = z.infer<typeof OrgUserListResponse>;

export const InviteOrgUserRequest = z.object({
  email: z.string().email('Enter a valid email'),
});
export type InviteOrgUserRequest = z.infer<typeof InviteOrgUserRequest>;

// --- providers ---
export const OrgProviderRow = z.object({
  id: z.string(),
  displayName: z.string(),
  providerKind: ProviderKind,
  isEnabled: z.boolean(),
  hasKey: z.boolean(),
  lastFour: z.string(),
});
export type OrgProviderRow = z.infer<typeof OrgProviderRow>;

export const OrgProvidersResponse = z.object({
  providers: z.array(OrgProviderRow),
});
export type OrgProvidersResponse = z.infer<typeof OrgProvidersResponse>;

export const OrgProviderResponse = z.object({
  provider: OrgProviderRow,
});
export type OrgProviderResponse = z.infer<typeof OrgProviderResponse>;

export const AddOrgProviderRequest = z.object({
  displayName: z.string().trim().min(1, 'Display name is required').max(80),
  providerKind: ProviderKind,
  apiKey: z.string().min(8, 'API key must be at least 8 characters'),
});
export type AddOrgProviderRequest = z.infer<typeof AddOrgProviderRequest>;

export const UpdateOrgProviderRequest = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  isEnabled: z.boolean().optional(),
});
export type UpdateOrgProviderRequest = z.infer<typeof UpdateOrgProviderRequest>;

export const RotateOrgProviderKeyRequest = z.object({
  apiKey: z.string().min(8, 'API key must be at least 8 characters'),
});
export type RotateOrgProviderKeyRequest = z.infer<typeof RotateOrgProviderKeyRequest>;

// --- templates ---
// Tag pattern: lowercase letter start, then lowercase letters/digits/hyphen, max 24 chars.
// Lowercase-only — no `/i` flag; UI lowercases on submit.
export const TemplateTag = z.string().regex(
  /^[a-z][a-z0-9-]{0,23}$/,
  'Tags use lowercase letters, digits, and hyphens; start with a letter (max 24).',
);
export type TemplateTag = z.infer<typeof TemplateTag>;

export const OrgTemplateRow = z.object({
  id: z.string(),
  name: z.string().min(2).max(80),
  description: z.string().max(280).optional(),
  body: z.string().min(1).max(8000),
  tags: z.array(TemplateTag).max(6),
  updatedAt: z.string().datetime(),
});
export type OrgTemplateRow = z.infer<typeof OrgTemplateRow>;

export const OrgTemplateListResponse = z.object({
  templates: z.array(OrgTemplateRow),
});
export type OrgTemplateListResponse = z.infer<typeof OrgTemplateListResponse>;

export const OrgTemplateCreateRequest = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  description: z.string().max(280).optional(),
  body: z.string().min(1, 'Body is required').max(8000),
  tags: z.array(TemplateTag).max(6, 'At most 6 tags'),
});
export type OrgTemplateCreateRequest = z.infer<typeof OrgTemplateCreateRequest>;

export const OrgTemplateUpdateRequest = OrgTemplateCreateRequest.partial();
export type OrgTemplateUpdateRequest = z.infer<typeof OrgTemplateUpdateRequest>;

// --- workspace providers ---
export const WsProviderItem = z.object({
  id: z.string(),
  displayName: z.string(),
  providerKind: ProviderKind,
});
export type WsProviderItem = z.infer<typeof WsProviderItem>;

export const WsProvidersResponse = z.object({
  available: z.array(WsProviderItem),
  bound: z.array(WsProviderItem),
});
export type WsProvidersResponse = z.infer<typeof WsProvidersResponse>;

export const PutWsProvidersRequest = z.object({
  providerIds: z.array(z.string().min(1)).max(100),
});
export type PutWsProvidersRequest = z.infer<typeof PutWsProvidersRequest>;

// --- workspace templates ---
export const WsAvailableTemplate = z.object({
  templateId: z.string(),
  name: z.string(),
});
export type WsAvailableTemplate = z.infer<typeof WsAvailableTemplate>;

export const WsBoundTemplate = z.object({
  templateId: z.string(),
  name: z.string(),
  suggestedRole: WorkspaceRole,
});
export type WsBoundTemplate = z.infer<typeof WsBoundTemplate>;

export const WsTemplatesResponse = z.object({
  available: z.array(WsAvailableTemplate),
  bound: z.array(WsBoundTemplate),
});
export type WsTemplatesResponse = z.infer<typeof WsTemplatesResponse>;

export const PutWsTemplatePair = z.object({
  templateId: z.string().min(1),
  suggestedRole: WorkspaceRole,
});
export type PutWsTemplatePair = z.infer<typeof PutWsTemplatePair>;

export const PutWsTemplatesRequest = z.object({
  templates: z.array(PutWsTemplatePair).max(100),
});
export type PutWsTemplatesRequest = z.infer<typeof PutWsTemplatesRequest>;

// --- workspace members ---
export const WsMemberRow = z.object({
  id: z.string(),
  email: z.string().email(),
  role: WorkspaceRole,
  joinedAt: z.string().datetime(),
});
export type WsMemberRow = z.infer<typeof WsMemberRow>;

export const WsMemberListResponse = z.object({
  members: z.array(WsMemberRow),
});
export type WsMemberListResponse = z.infer<typeof WsMemberListResponse>;

export const InviteWsMemberRequest = z.object({
  email: z.string().email('Enter a valid email'),
  role: WorkspaceRole,
});
export type InviteWsMemberRequest = z.infer<typeof InviteWsMemberRequest>;

export const ChangeWsMemberRoleRequest = z.object({
  role: WorkspaceRole,
});
export type ChangeWsMemberRoleRequest = z.infer<
  typeof ChangeWsMemberRoleRequest
>;

// --- workspace roles ---
export const WsRoleCatalogueEntry = z.object({
  role: WorkspaceRole,
  description: z.string(),
});
export type WsRoleCatalogueEntry = z.infer<typeof WsRoleCatalogueEntry>;

export const WsRoleListResponse = z.object({
  roles: z.array(WsRoleCatalogueEntry),
});
export type WsRoleListResponse = z.infer<typeof WsRoleListResponse>;

export const LAST_ADMIN_CODE = 'last_admin' as const;
