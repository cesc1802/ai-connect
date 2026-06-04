import { z } from 'zod';

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
