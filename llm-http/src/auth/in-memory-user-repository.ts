import { randomUUID } from "node:crypto";
import {
  UsernameTakenError,
  type NewUser,
  type UserRecord,
  type UserRepository,
} from "./user-repository.js";

export class InMemoryUserRepository implements UserRepository {
  constructor(private users: Map<string, UserRecord>) {}

  async findByUsername(username: string): Promise<UserRecord | null> {
    return this.users.get(username) ?? null;
  }

  async create(input: NewUser): Promise<UserRecord> {
    if (this.users.has(input.username)) {
      throw new UsernameTakenError(input.username);
    }
    const record: UserRecord = { id: randomUUID(), ...input };
    this.users.set(record.username, record);
    return record;
  }
}
