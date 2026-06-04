import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encrypts provider API keys at rest using AES-256-GCM.
// Key rotation: see ops doc — store key version with ciphertext for forward-compat.
//
// Ciphertext format: `iv:ciphertext:authTag` (all hex).
// The 32-byte symmetric key MUST come from PROVIDER_KEY_VAULT_KEY env var (hex-encoded).

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;

export interface VaultEnv {
  PROVIDER_KEY_VAULT_KEY?: string | undefined;
  NODE_ENV?: string | undefined;
}

function decodeKey(hex: string): Buffer {
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error("PROVIDER_KEY_VAULT_KEY must be hex-encoded");
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `PROVIDER_KEY_VAULT_KEY must decode to ${KEY_BYTES} bytes (got ${buf.length})`,
    );
  }
  return buf;
}

export class ApiKeyVault {
  private readonly key: Buffer;

  constructor(env: VaultEnv) {
    const raw = env.PROVIDER_KEY_VAULT_KEY;
    if (!raw) {
      if (env.NODE_ENV === "test") {
        this.key = randomBytes(KEY_BYTES);
        return;
      }
      throw new Error(
        "PROVIDER_KEY_VAULT_KEY is required (32-byte hex). Set the env var to a stable secret.",
      );
    }
    this.key = decodeKey(raw);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${ciphertext.toString("hex")}:${authTag.toString("hex")}`;
  }

  decrypt(payload: string): string {
    const parts = payload.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid vault payload format");
    }
    const [ivHex, ciphertextHex, authTagHex] = parts as [string, string, string];
    const iv = Buffer.from(ivHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  }
}

export function lastFourOf(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) return trimmed;
  return trimmed.slice(-4);
}
