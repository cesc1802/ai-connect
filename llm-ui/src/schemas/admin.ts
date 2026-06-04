import { z } from 'zod';

export const AdminScope = z.enum(['org', 'workspace']);
export type AdminScope = z.infer<typeof AdminScope>;
