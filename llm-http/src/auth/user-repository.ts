export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
}

export interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
}
