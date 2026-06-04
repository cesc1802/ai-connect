import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { ApiKeyVault, lastFourOf } from "./api-key-vault.js";

function freshKey(): string {
  return randomBytes(32).toString("hex");
}

describe("ApiKeyVault", () => {
  it("roundtrips plaintext through encrypt/decrypt", () => {
    const vault = new ApiKeyVault({ PROVIDER_KEY_VAULT_KEY: freshKey() });
    const plaintext = "sk-test-abcdef-1234";
    const ciphertext = vault.encrypt(plaintext);

    expect(ciphertext).not.toContain(plaintext);
    expect(ciphertext.split(":")).toHaveLength(3);
    expect(vault.decrypt(ciphertext)).toBe(plaintext);
  });

  it("produces a new IV per encryption (same plaintext → different ciphertext)", () => {
    const vault = new ApiKeyVault({ PROVIDER_KEY_VAULT_KEY: freshKey() });
    const a = vault.encrypt("sk-x");
    const b = vault.encrypt("sk-x");
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext (authTag fails)", () => {
    const vault = new ApiKeyVault({ PROVIDER_KEY_VAULT_KEY: freshKey() });
    const payload = vault.encrypt("sk-secret");
    const [iv, ciphertext, authTag] = payload.split(":") as [
      string,
      string,
      string,
    ];
    const tamperedAuthTag = authTag
      .split("")
      .reverse()
      .join("");
    const tampered = `${iv}:${ciphertext}:${tamperedAuthTag}`;
    expect(() => vault.decrypt(tampered)).toThrow();
  });

  it("throws on malformed payload", () => {
    const vault = new ApiKeyVault({ PROVIDER_KEY_VAULT_KEY: freshKey() });
    expect(() => vault.decrypt("not-a-vault-payload")).toThrow();
    expect(() => vault.decrypt("a:b")).toThrow();
  });

  describe("construction", () => {
    it("throws when env key missing outside test mode", () => {
      expect(
        () => new ApiKeyVault({ NODE_ENV: "development" }),
      ).toThrow(/PROVIDER_KEY_VAULT_KEY is required/);
      expect(
        () => new ApiKeyVault({ NODE_ENV: "production" }),
      ).toThrow(/PROVIDER_KEY_VAULT_KEY is required/);
    });

    it("generates a random key in test mode when env missing", () => {
      const vault = new ApiKeyVault({ NODE_ENV: "test" });
      const ct = vault.encrypt("sk-x");
      expect(vault.decrypt(ct)).toBe("sk-x");
    });

    it("throws on non-hex key", () => {
      expect(
        () => new ApiKeyVault({ PROVIDER_KEY_VAULT_KEY: "not-hex!!!" }),
      ).toThrow(/hex-encoded/);
    });

    it("throws on wrong key length", () => {
      expect(
        () =>
          new ApiKeyVault({
            PROVIDER_KEY_VAULT_KEY: "abcd1234",
          }),
      ).toThrow(/32 bytes/);
    });
  });
});

describe("lastFourOf", () => {
  it("returns the trailing four characters", () => {
    expect(lastFourOf("sk-abcdef1234")).toBe("1234");
  });

  it("returns whole string when shorter than four", () => {
    expect(lastFourOf("abc")).toBe("abc");
  });

  it("trims whitespace before slicing", () => {
    expect(lastFourOf("  sk-abcdef5678  ")).toBe("5678");
  });
});
