import { describe, it, expect, beforeEach } from "vitest";
import { JwtService, type JwtSignContext } from "../jwt-service.js";
import type { User } from "@ai-connect/shared";

describe("JwtService", () => {
  let jwtService: JwtService;
  const secret = "a".repeat(32);
  const testUser: User = { id: "test-123", username: "testuser" };
  const ctx: JwtSignContext = {
    org: "org-1",
    orgRole: "admin",
    workspace: "ws-1",
    workspaceRole: "admin",
  };

  beforeEach(() => {
    jwtService = new JwtService(secret, "1h");
  });

  describe("sign", () => {
    it("should create a valid JWT token", () => {
      const token = jwtService.sign(testUser, ctx);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("should include user id and username in token payload", () => {
      const token = jwtService.sign(testUser, ctx);
      const payload = jwtService.verify(token);
      expect(payload.sub).toBe(testUser.id);
      expect(payload.username).toBe(testUser.username);
    });

    it("should include org, orgRole, workspace, workspaceRole claims", () => {
      const token = jwtService.sign(testUser, ctx);
      const payload = jwtService.verify(token);
      expect(payload.org).toBe("org-1");
      expect(payload.orgRole).toBe("admin");
      expect(payload.workspace).toBe("ws-1");
      expect(payload.workspaceRole).toBe("admin");
    });

    it("should accept null workspace and workspaceRole", () => {
      const token = jwtService.sign(testUser, {
        org: "org-1",
        orgRole: "member",
        workspace: null,
        workspaceRole: null,
      });
      const payload = jwtService.verify(token);
      expect(payload.workspace).toBeNull();
      expect(payload.workspaceRole).toBeNull();
      expect(payload.orgRole).toBe("member");
    });

    it("should roundtrip viewer workspaceRole", () => {
      const token = jwtService.sign(testUser, { ...ctx, workspaceRole: "viewer" });
      expect(jwtService.verify(token).workspaceRole).toBe("viewer");
    });

    it("should generate different tokens for same user (due to iat)", async () => {
      const token1 = jwtService.sign(testUser, ctx);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const token2 = jwtService.sign(testUser, ctx);
      expect(token1).not.toBe(token2);
    });
  });

  describe("verify", () => {
    it("should successfully verify a valid token", () => {
      const token = jwtService.sign(testUser, ctx);
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
      const token = jwtService.sign(testUser, ctx);
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
      const token = jwtService.sign(testUser, ctx);
      const payload = jwtService.verify(token);
      expect(payload.iat).toBeGreaterThan(0);
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });
  });

  describe("expiration", () => {
    it("should respect expiresIn configuration", () => {
      const shortService = new JwtService(secret, "10s");
      const token = shortService.sign(testUser, ctx);
      const payload = shortService.verify(token);
      expect(payload.exp - payload.iat).toBe(10);
    });

    it("should create tokens with correct expiration time", () => {
      const oneHourService = new JwtService(secret, "1h");
      const token = oneHourService.sign(testUser, ctx);
      const payload = oneHourService.verify(token);
      expect(payload.exp - payload.iat).toBe(3600);
    });
  });

  describe("different secrets", () => {
    it("should fail verification with different secret", () => {
      const service1 = new JwtService(secret, "1h");
      const service2 = new JwtService("b".repeat(32), "1h");
      const token = service1.sign(testUser, ctx);
      expect(() => service2.verify(token)).toThrow();
    });
  });

  // HTTP header budgets cap a single header at ~8 KB; the access token must
  // stay well under that. 1 KB is the per-token ceiling for the new claims.
  describe("payload size budget", () => {
    it("keeps signed token under 1 KB with realistic claims", () => {
      const realisticUser: User = {
        id: "usr_01HZX7Q9YJ4M5K6N7P8Q9R0S1T",
        username: "alice.workspace-admin@long-org-name.example.com",
      };
      const realisticCtx: JwtSignContext = {
        org: "org_01HZX7Q9YJ4M5K6N7P8Q9R0S1U",
        orgRole: "admin",
        workspace: "ws_01HZX7Q9YJ4M5K6N7P8Q9R0S1V",
        workspaceRole: "owner",
      };
      const token = jwtService.sign(realisticUser, realisticCtx);
      expect(Buffer.byteLength(token, "utf8")).toBeLessThan(1024);
    });

    it("stays under 600 B for typical claim sizes", () => {
      const token = jwtService.sign(testUser, ctx);
      expect(Buffer.byteLength(token, "utf8")).toBeLessThan(600);
    });
  });
});
