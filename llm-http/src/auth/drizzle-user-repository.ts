import { eq } from "drizzle-orm";
import { users, type DbClient } from "@ai-connect/db";
import type { SystemRole } from "@ai-connect/shared";
import {
  UsernameTakenError,
  type NewUser,
  type UserRecord,
  type UserRepository,
} from "./user-repository.js";

type UserRow = typeof users.$inferSelect;

/** Postgres SQLSTATE for unique_violation (username is the only unique column). */
const UNIQUE_VIOLATION = "23505";

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly client: DbClient) {}

  async findByUsername(username: string): Promise<UserRecord | null> {
    const [row] = await this.client.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async create(input: NewUser): Promise<UserRecord> {
    try {
      const [row] = await this.client.db
        .insert(users)
        .values({
          username: input.username,
          passwordHash: input.passwordHash,
          role: input.role,
        })
        .returning();
      return toRecord(row!);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new UsernameTakenError(input.username);
      }
      throw err;
    }
  }
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    // Column is plain text; the app constrains values to SystemRole on write.
    role: row.role as SystemRole,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === UNIQUE_VIOLATION
  );
}
