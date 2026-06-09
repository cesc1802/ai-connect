import { describe, it, expect, beforeEach } from "vitest";
import { JwtService } from "../jwt-service.js";
import type { User } from "@ai-connect/shared";

describe("JwtService", () => {
  let jwtService: JwtService;
  const secret = "a".repeat(32);
  const testUser: User = { id: "test-123", username: "testuser" };

  beforeEach(() => {
    jwtService = new JwtService(secret, "1h");
  });

  describe("sign", () => {
    it("should create a valid JWT token", () => {
      const token = jwtService.sign(testUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("should include user id and username in token payload", () => {
      const token = jwtService.sign(testUser);
      const payload = jwtService.verify(token);
      expect(payload.sub).toBe(testUser.id);
      expect(payload.username).toBe(testUser.username);
    });

    it("should carry identity-only claims (no org/workspace)", () => {
      const token = jwtService.sign(testUser);
      const payload = jwtService.verify(token) as Record<string, unknown>;
      expect(payload.org).toBeUndefined();
      expect(payload.orgRole).toBeUndefined();
      expect(payload.workspace).toBeUndefined();
      expect(payload.workspaceRole).toBeUndefined();
    });

    it("should generate different tokens for same user (due to iat)", async () => {
      const token1 = jwtService.sign(testUser);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const token2 = jwtService.sign(testUser);
      expect(token1).not.toBe(token2);
    });
  });

  describe("verify", () => {
    it("should successfully verify a valid token", () => {
      const token = jwtService.sign(testUser);
      const payload = jwtService.verify(token);
      expect(payload.sub).toBe(testUser.id);
      expect(payload.username).toBe(testUser.username);
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
    });

    it("should throw error for invalid token", () => {
      expect(() => jwtService.verify("invalid.token.here")).toThrow();
    });

    it("should throw error for tampered token", () => {
      const token = jwtService.sign(testUser);
      const parts = token.split(".");
      const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`;
      expect(() => jwtService.verify(tamperedToken)).toThrow();
    });

    it("should throw error for malformed token", () => {
      expect(() => jwtService.verify("just.two")).toThrow();
      expect(() => jwtService.verify("onepart")).toThrow();
    });

    it("should throw error for empty token", () => {
      expect(() => jwtService.verify("")).toThrow();
    });

    it("should include iat and exp claims", () => {
      const token = jwtService.sign(testUser);
      const payload = jwtService.verify(token);
      expect(payload.iat).toBeGreaterThan(0);
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });
  });

  describe("expiration", () => {
    it("should respect expiresIn configuration", () => {
      const shortService = new JwtService(secret, "10s");
      const token = shortService.sign(testUser);
      const payload = shortService.verify(token);
      expect(payload.exp - payload.iat).toBe(10);
    });

    it("should create tokens with correct expiration time", () => {
      const oneHourService = new JwtService(secret, "1h");
      const token = oneHourService.sign(testUser);
      const payload = oneHourService.verify(token);
      expect(payload.exp - payload.iat).toBe(3600);
    });
  });

  describe("different secrets", () => {
    it("should fail verification with different secret", () => {
      const service1 = new JwtService(secret, "1h");
      const service2 = new JwtService("b".repeat(32), "1h");
      const token = service1.sign(testUser);
      expect(() => service2.verify(token)).toThrow();
    });
  });

  // HTTP header budgets cap a single header at ~8 KB; the access token must
  // stay well under that. With identity-only claims it stays comfortably small.
  describe("payload size budget", () => {
    it("keeps signed token under 1 KB with realistic claims", () => {
      const realisticUser: User = {
        id: "usr_01HZX7Q9YJ4M5K6N7P8Q9R0S1T",
        username: "alice.workspace-admin@long-org-name.example.com",
      };
      const token = jwtService.sign(realisticUser);
      expect(Buffer.byteLength(token, "utf8")).toBeLessThan(1024);
    });

    it("stays under 600 B for typical claim sizes", () => {
      const token = jwtService.sign(testUser);
      expect(Buffer.byteLength(token, "utf8")).toBeLessThan(600);
    });
  });
});
