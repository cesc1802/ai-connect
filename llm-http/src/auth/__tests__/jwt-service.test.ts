import { describe, it, expect, beforeEach } from "vitest";
import { JwtService } from "../jwt-service.js";
import type { User } from "@ai-connect/shared";

describe("JwtService", () => {
  let jwtService: JwtService;
  const secret = "a".repeat(32); // 32 char minimum
  const testUser: User = { id: "test-123", username: "testuser" };

  beforeEach(() => {
    jwtService = new JwtService(secret, "1h");
  });

  describe("sign", () => {
    it("should create a valid JWT token", () => {
      const token = jwtService.sign(testUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });

    it("should include user id and username in token payload", () => {
      const token = jwtService.sign(testUser);
      const payload = jwtService.verify(token);
      expect(payload.sub).toBe(testUser.id);
      expect(payload.username).toBe(testUser.username);
    });

    it("should generate different tokens for same user (due to iat)", async () => {
      const token1 = jwtService.sign(testUser);
      // Delay to ensure different iat (JWT uses second precision)
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
      const expiresInSeconds = payload.exp - payload.iat;
      expect(expiresInSeconds).toBe(10);
    });

    it("should create tokens with correct expiration time", () => {
      const oneHourService = new JwtService(secret, "1h");
      const token = oneHourService.sign(testUser);
      const payload = oneHourService.verify(token);
      const expiresInSeconds = payload.exp - payload.iat;
      expect(expiresInSeconds).toBe(3600);
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
});
