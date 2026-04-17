import type { UserRecord } from "./user-repository.js";

export function seedUsers(seed: UserRecord[]): Map<string, UserRecord> {
  const map = new Map<string, UserRecord>();
  for (const user of seed) {
    map.set(user.username, user);
  }
  return map;
}
