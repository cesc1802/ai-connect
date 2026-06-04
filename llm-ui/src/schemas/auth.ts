import { z } from 'zod';

export const OrgRole = z.enum(['admin', 'member']);
export type OrgRole = z.infer<typeof OrgRole>;

export const WorkspaceRole = z.enum(['owner', 'admin', 'member', 'viewer']);
export type WorkspaceRole = z.infer<typeof WorkspaceRole>;

export const SessionUser = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  orgId: z.string(),
  orgRole: OrgRole,
  workspaceId: z.string().nullable(),
  workspaceRole: WorkspaceRole.nullable(),
});
export type SessionUser = z.infer<typeof SessionUser>;

export const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const LoginResponse = z.object({
  accessToken: z.string(),
  expiresInSec: z.number().int().positive(),
  user: SessionUser,
});
export type LoginResponse = z.infer<typeof LoginResponse>;

export const RefreshResponse = z.object({
  accessToken: z.string(),
  expiresInSec: z.number().int().positive(),
  user: SessionUser,
});
export type RefreshResponse = z.infer<typeof RefreshResponse>;

export const LogoutResponse = z.object({
  ok: z.literal(true),
});
export type LogoutResponse = z.infer<typeof LogoutResponse>;
