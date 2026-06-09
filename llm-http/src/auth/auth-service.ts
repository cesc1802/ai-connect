import bcrypt from "bcryptjs";
import type { CredentialsVerifier } from "./credentials-verifier.js";
import type { JwtService } from "./jwt-service.js";
import type { UserRecord, UserRepository } from "./user-repository.js";

const BCRYPT_COST = 10;

export interface LoginResult {
  token: string;
  expiresIn: string;
}

/**
 * Owns the auth business logic so routes stay thin controllers:
 * login orchestrates credential check + token issuance; register hashes the
 * password and persists a new user.
 */
export class AuthService {
  constructor(
    private readonly verifier: CredentialsVerifier,
    private readonly jwt: JwtService,
    private readonly repo: UserRepository,
    private readonly jwtExpiresIn: string
  ) {}

  async login(username: string, password: string): Promise<LoginResult | null> {
    const user = await this.verifier.verify(username, password);
    if (!user) return null;
    return { token: this.jwt.sign(user), expiresIn: this.jwtExpiresIn };
  }

  /**
   * Creates a "member" user. Role is fixed here — never taken from the request
   * body — so signup cannot self-assign admin. Throws UsernameTakenError when
   * the username already exists.
   */
  async register(username: string, password: string): Promise<UserRecord> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    return this.repo.create({ username, passwordHash, role: "member" });
  }
}
