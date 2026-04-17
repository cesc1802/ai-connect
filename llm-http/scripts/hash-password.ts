#!/usr/bin/env tsx
import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error("Usage: tsx scripts/hash-password.ts <password>");
  process.exit(1);
}

const BCRYPT_ROUNDS = 10;
const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);

console.log("\nGenerated bcrypt hash:");
console.log(hash);
console.log("\nExample DEMO_USERS env value:");
console.log(
  JSON.stringify([{ id: "user-1", username: "demo", passwordHash: hash }])
);
