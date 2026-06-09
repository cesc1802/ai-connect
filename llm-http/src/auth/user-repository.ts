import type { SystemRole } from "@ai-connect/shared";

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: SystemRole;
}

export interface NewUser {
  username: string;
  passwordHash: string;
  role: SystemRole;
}

export interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
  create(input: NewUser): Promise<UserRecord>;
}

/** Thrown by create() when the username already exists (unique constraint). */
export class UsernameTakenError extends Error {
  constructor(username: string) {
    super(`Username already taken: ${username}`);
    this.name = "UsernameTakenError";
  }
}
