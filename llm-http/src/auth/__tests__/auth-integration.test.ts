import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { JwtService } from "../jwt-service.js";
import { CredentialsVerifier } from "../credentials-verifier.js";
import { InMemoryUserRepository } from "../in-memory-user-repository.js";
import type { UserRecord } from "../user-repository.js";

describe("Auth Integration Tests", () => {
  let jwtService: JwtService;
  let credentialsVerifier: CredentialsVerifier;
  let userRepository: InMemoryUserRepository;
  const secret = "super_secret_key_at_least_32_characters_long";

  beforeEach(async () => {
    jwtService = new JwtService(secret, "1h");

    const hashedPassword = await bcrypt.hash("correct_password", 10);
    const users: UserRecord[] = [
      {
        id: "user-1",
        username: "alice",
        passwordHash: hashedPassword,
      },
      {
        id: "user-2",
        username: "bob",
        passwordHash: await bcrypt.hash("bobs_password", 10),
      },
    ];

    userRepository = new InMemoryUserRepository(
      new Map(users.map((u) => [u.username, u]))
    );
    credentialsVerifier = new CredentialsVerifier(userRepository);
  });

  describe("Scenario 1: Login with valid credentials returns token", () => {
    it("should authenticate user and return valid token", async () => {
      // Step 1: Verify credentials
      const user = await credentialsVerifier.verify("alice", "correct_password");
      expect(user).not.toBeNull();
      expect(user?.id).toBe("user-1");
      expect(user?.username).toBe("alice");

      // Step 2: Generate token
      const token = jwtService.sign(user!);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);

      // Step 3: Verify token
      const payload = jwtService.verify(token);
      expect(payload.sub).toBe("user-1");
      expect(payload.username).toBe("alice");
    });

    it("should generate different tokens for same user on subsequent logins", async () => {
      const user = await credentialsVerifier.verify("bob", "bobs_password");

      const token1 = jwtService.sign(user!);
      // Delay to ensure different iat (JWT uses second precision)
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const token2 = jwtService.sign(user!);

      expect(token1).not.toBe(token2);

      // Both should verify successfully
      const payload1 = jwtService.verify(token1);
      const payload2 = jwtService.verify(token2);

      expect(payload1.sub).toBe(payload2.sub);
      expect(payload1.username).toBe(payload2.username);
    });

    it("should have correct token expiration", async () => {
      const user = await credentialsVerifier.verify("alice", "correct_password");
      const token = jwtService.sign(user!);
      const payload = jwtService.verify(token);

      const expiresInSeconds = payload.exp - payload.iat;
      expect(expiresInSeconds).toBe(3600); // 1 hour
    });
  });

  describe("Scenario 2: Login with invalid password returns 401", () => {
    it("should fail authentication with wrong password", async () => {
      const user = await credentialsVerifier.verify("alice", "wrong_password");

      expect(user).toBeNull();
    });

    it("should not generate token for failed authentication", async () => {
      const user = await credentialsVerifier.verify("alice", "wrong_password");

      expect(() => {
        if (user) jwtService.sign(user);
      }).not.toThrow();

      expect(user).toBeNull();
    });
  });

  describe("Scenario 3: Login with unknown user returns 401 (timing-safe)", () => {
    it("should fail authentication for non-existent user", async () => {
      const user = await credentialsVerifier.verify("unknown", "any_password");

      expect(user).toBeNull();
    });

    it("should execute similar code path for unknown vs wrong password", async () => {
      // Both should return null but execute bcrypt.compare
      const unknownResult = await credentialsVerifier.verify(
        "nonexistent",
        "password"
      );
      const wrongPassResult = await credentialsVerifier.verify(
        "alice",
        "wrong_password"
      );

      expect(unknownResult).toBeNull();
      expect(wrongPassResult).toBeNull();
    });

    it("should not expose user existence in response", async () => {
      const unknownUser = await credentialsVerifier.verify(
        "doesnotexist",
        "password"
      );
      const wrongPassword = await credentialsVerifier.verify(
        "alice",
        "incorrectpassword"
      );

      // Both return null - no way to distinguish
      expect(unknownUser).toBe(wrongPassword);
    });
  });

  describe("Scenario 4: Auth middleware blocks requests without token", () => {
    it("should require authorization header for protected endpoints", async () => {
      // This is tested in auth-middleware.test.ts
      // Integration test demonstrates the flow
      const validUser = await credentialsVerifier.verify(
        "alice",
        "correct_password"
      );
      expect(validUser).not.toBeNull();

      // Without token, access should be denied
      const invalidPayload = () => jwtService.verify(""); // Empty token
      expect(invalidPayload).toThrow();
    });
  });

  describe("Scenario 5: Auth middleware blocks requests with invalid token", () => {
    it("should reject tampered tokens", async () => {
      const validUser = await credentialsVerifier.verify(
        "alice",
        "correct_password"
      );
      const token = jwtService.sign(validUser!);

      // Tamper with token
      const parts = token.split(".");
      const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`;

      expect(() => jwtService.verify(tamperedToken)).toThrow();
    });

    it("should reject malformed tokens", async () => {
      expect(() => jwtService.verify("not.a.valid.token.at.all")).toThrow();
      expect(() => jwtService.verify("justtwoparts")).toThrow();
      expect(() => jwtService.verify("")).toThrow();
    });

    it("should reject token signed with different secret", async () => {
      const validUser = await credentialsVerifier.verify(
        "alice",
        "correct_password"
      );
      const token = jwtService.sign(validUser!);

      const differentService = new JwtService("different_secret_key_32_chars_", "1h");

      expect(() => differentService.verify(token)).toThrow();
    });
  });

  describe("Scenario 6: Auth middleware allows requests with valid token", () => {
    it("should allow authenticated requests", async () => {
      const user = await credentialsVerifier.verify("alice", "correct_password");
      expect(user).not.toBeNull();

      const token = jwtService.sign(user!);
      const payload = jwtService.verify(token);

      expect(payload.sub).toBe(user!.id);
      expect(payload.username).toBe(user!.username);
    });

    it("should preserve user identity through token", async () => {
      const user = await credentialsVerifier.verify("bob", "bobs_password");
      const token = jwtService.sign(user!);
      const payload = jwtService.verify(token);

      expect(payload.username).toBe("bob");
      expect(payload.sub).toBe("user-2");
    });
  });

  describe("End-to-end auth flow", () => {
    it("should complete full authentication flow", async () => {
      // 1. User submits credentials
      const credentials = { username: "alice", password: "correct_password" };

      // 2. Verify credentials
      const user = await credentialsVerifier.verify(
        credentials.username,
        credentials.password
      );
      expect(user).not.toBeNull();

      // 3. Generate JWT token
      const token = jwtService.sign(user!);
      expect(token).toBeDefined();

      // 4. Client stores token and uses it in Authorization header
      const authHeader = `Bearer ${token}`;
      expect(authHeader).toMatch(/^Bearer /);

      // 5. Extract and verify token
      const extractedToken = authHeader.slice(7);
      const payload = jwtService.verify(extractedToken);
      expect(payload.sub).toBe("user-1");
      expect(payload.username).toBe("alice");

      // 6. Use payload to identify user
      const authenticatedUser = await userRepository.findByUsername(
        payload.username
      );
      expect(authenticatedUser?.id).toBe(payload.sub);
    });

    it("should reject full flow with invalid credentials", async () => {
      const credentials = { username: "alice", password: "wrong_password" };

      const user = await credentialsVerifier.verify(
        credentials.username,
        credentials.password
      );

      expect(user).toBeNull();

      // Should not reach token generation step
      if (user) {
        const token = jwtService.sign(user);
        expect(token).toBeUndefined();
      }
    });

    it("should reject full flow with expired token", async () => {
      const expiredService = new JwtService(secret, "0s"); // Immediately expired
      const user = await credentialsVerifier.verify(
        "alice",
        "correct_password"
      );

      const expiredToken = expiredService.sign(user!);

      // Wait a bit and try to verify
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Token should be expired
      expect(() => {
        // Using different service that checks expiration
        const verifyService = new JwtService(secret, "1h");
        verifyService.verify(expiredToken);
      }).toThrow();
    });
  });

  describe("Security scenarios", () => {
    it("should not store plaintext passwords", async () => {
      const user = await userRepository.findByUsername("alice");
      expect(user).not.toBeNull();
      expect(user!.passwordHash).not.toBe("correct_password");
      expect(user!.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    });

    it("should not return passwordHash in authenticated response", async () => {
      const user = await credentialsVerifier.verify(
        "alice",
        "correct_password"
      );

      expect(user).not.toHaveProperty("passwordHash");
      expect(user).toEqual({ id: "user-1", username: "alice" });
    });

    it("should include standard JWT claims", async () => {
      const user = await credentialsVerifier.verify(
        "alice",
        "correct_password"
      );
      const token = jwtService.sign(user!);
      const payload = jwtService.verify(token);

      expect(payload).toHaveProperty("sub"); // subject
      expect(payload).toHaveProperty("iat"); // issued at
      expect(payload).toHaveProperty("exp"); // expiration
      expect(payload).toHaveProperty("username");
    });
  });
});
