import type { SystemRole } from "@ai-connect/shared";

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: SystemRole;
}

export interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
}
