import type { UserRepository, UserRecord } from "./user-repository.js";

export class InMemoryUserRepository implements UserRepository {
  constructor(private users: Map<string, UserRecord>) {}

  async findByUsername(username: string): Promise<UserRecord | null> {
    return this.users.get(username) ?? null;
  }
}
