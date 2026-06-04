import { z } from 'zod';
import { ProviderKind } from './resources';

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
