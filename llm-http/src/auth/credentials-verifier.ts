import bcrypt from "bcryptjs";
import type { User } from "@ai-connect/shared";
import type { UserRepository } from "./user-repository.js";

const DUMMY_HASH = "$2a$10$BAT6YZKBYfYZE.lVE24YIOQucrZXOcRrgToypYv7pmctqfD6f40X.";

export class CredentialsVerifier {
  constructor(private repo: UserRepository) {}

  async verify(username: string, password: string): Promise<User | null> {
    const user = await this.repo.findByUsername(username);

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? { id: user.id, username: user.username } : null;
  }
}
